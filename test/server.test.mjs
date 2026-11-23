import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createRequestHandler as createHandler, parseBranchCommit, resolveBranchCommit, resolveFilePath } from '../server.mjs';

const defaultCommit = 'a'.repeat(40);
const createRequestHandler = options => createHandler({ getCommit: async () => defaultCommit, ...options });

async function request(handler, url, method = 'GET', headers = {}) {
  const chunks = [];
  const res = new Writable({
    write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
  });
  res.statusCode = 200;
  res.headers = new Map();
  res.setHeader = (name, value) => res.headers.set(name.toLowerCase(), value);
  await handler({ url, method, headers }, res);
  return { status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) };
}

const quiet = { error() {} };

test('root, folders, query strings, and exact filenames map to GitHub files', () => {
  assert.equal(resolveFilePath('/'), 'index.html');
  assert.equal(resolveFilePath('/case-study/'), 'case-study/index.html');
  assert.equal(resolveFilePath('/lyzr-contact.html?campaign=hello'), 'lyzr-contact.html');
  assert.equal(resolveFilePath('/assets/hello%20world.svg'), 'assets/hello world.svg');
  for (const path of ['/../private.html', '/%2e%2e/private.html', '/.git/config', '/.env', '//outside.html', '/bad%ZZ.html', '/bad%00.html', '/assets\\bad.html', '/server.mjs', '/package.json', '/test/check.html']) {
    assert.equal(resolveFilePath(path), null, path);
  }
});

test('new pages, edits, and deletions are visible without restarting', async () => {
  const pages = new Map();
  const urls = [];
  let commit = defaultCommit;
  const handler = createRequestHandler({ logger: quiet, getCommit: async () => commit, fetchFile: async url => {
    urls.push(new URL(url));
    const body = pages.get(new URL(url).pathname);
    return new Response(body || 'Not found', { status: body ? 200 : 404 });
  } });
  const path = () => `/leano07-oss/lyzr.new/${commit}/new-page.html`;
  assert.equal((await request(handler, '/new-page.html')).status, 404);
  commit = 'b'.repeat(40);
  pages.set(path(), '<h1>New page</h1>');
  assert.equal((await request(handler, '/new-page.html')).body.toString(), '<h1>New page</h1>');
  commit = 'c'.repeat(40);
  pages.set(path(), '<h1>Edited page</h1>');
  assert.equal((await request(handler, '/new-page.html')).body.toString(), '<h1>Edited page</h1>');
  commit = 'd'.repeat(40);
  assert.equal((await request(handler, '/new-page.html')).status, 404);
  assert.equal(new Set(urls.map(url => url.pathname)).size, 4);
  assert.ok(urls.every(url => url.origin === 'https://raw.githubusercontent.com'));
});

test('HTML and binary assets keep their contents and receive correct MIME types', async () => {
  const binary = new Uint8Array([0, 128, 255, 17]);
  const handler = createRequestHandler({ logger: quiet, fetchFile: async url => new Response(
    url.pathname.endsWith('.png') ? binary : '<h1>Hello</h1>',
    { headers: { 'content-type': 'text/plain', 'content-security-policy': "default-src 'none'" } },
  ) });
  const html = await request(handler, '/');
  assert.match(html.headers.get('content-type'), /text\/html/);
  assert.match(html.headers.get('cache-control'), /no-store/);
  assert.equal(html.headers.has('content-security-policy'), false);
  assert.equal(html.body.toString(), '<h1>Hello</h1>');
  const image = await request(handler, '/assets/photo.png');
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(image.body, Buffer.from(binary));
});

test('HEAD is forwarded without a body; user query strings never reach GitHub', async () => {
  let forwarded;
  const handler = createRequestHandler({ logger: quiet, fetchFile: async (url, options) => {
    forwarded = { url, options };
    return new Response(null);
  } });
  const result = await request(handler, '/lyzr-contact.html?refresh=fixed&redirect=https://example.com', 'HEAD');
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 0);
  assert.equal(forwarded.options.method, 'HEAD');
  assert.equal(forwarded.options.redirect, 'error');
  assert.equal(forwarded.url.searchParams.has('redirect'), false);
  assert.equal(forwarded.url.search, '');
});

test('Git branch references select the exact branch and reject malformed data', async () => {
  const packet = line => (Buffer.byteLength(line) + 4).toString(16).padStart(4, '0') + line;
  const advertisement = packet('# service=git-upload-pack\n') + '0000' + packet(`${'b'.repeat(40)} HEAD\0multi_ack\n`) + packet(`${defaultCommit} refs/heads/main\n`) + '0000';
  assert.equal(parseBranchCommit(Buffer.from(advertisement), 'main'), defaultCommit);
  assert.throws(() => parseBranchCommit(Buffer.from(advertisement), 'missing'), /not found/);
  assert.throws(() => parseBranchCommit(Buffer.from('zzzz'), 'main'), /Invalid/);
  assert.throws(() => parseBranchCommit(Buffer.from('0010short'), 'main'), /Truncated/);
  const result = await resolveBranchCommit('leano07-oss/lyzr.new', 'main', async (url, options) => {
    assert.equal(url, 'https://github.com/leano07-oss/lyzr.new.git/info/refs?service=git-upload-pack');
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    return new Response(advertisement);
  });
  assert.equal(result, defaultCommit);
});

test('upstream outages do not masquerade as missing pages', async () => {
  for (const fetchFile of [async () => new Response('Unavailable', { status: 429 }), async () => { throw new Error('timeout'); }]) {
    const handler = createRequestHandler({ fetchFile, logger: quiet });
    const result = await request(handler, '/lyzr-contact.html');
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('retry-after'), '30');
    assert.match(result.headers.get('cache-control'), /no-store/);
  }
});

test('unsupported paths and write requests never contact GitHub', async () => {
  const handler = createRequestHandler({ logger: quiet, fetchFile: async () => assert.fail('unexpected request') });
  assert.equal((await request(handler, '/.env')).status, 404);
  assert.equal((await request(handler, '/index.html', 'POST')).status, 405);
});

test('asset byte ranges pass through', async () => {
  const handler = createRequestHandler({ logger: quiet, fetchFile: async (_url, options) => {
    assert.equal(options.headers.Range, 'bytes=0-2');
    return new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { 'content-range': 'bytes 0-2/10' } });
  } });
  const result = await request(handler, '/assets/video.mp4', 'GET', { range: 'bytes=0-2' });
  assert.equal(result.status, 206);
  assert.equal(result.headers.get('content-range'), 'bytes 0-2/10');
  assert.deepEqual(result.body, Buffer.from([1, 2, 3]));
});
