import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const contentTypes = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
}));

const infrastructure = new Set([
  'server.mjs', 'package.json', 'package-lock.json', 'test', 'tests',
]);

export function resolveFilePath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.split('?')[0]);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(pathname)) return null;
  const parts = pathname.slice(1).split('/');
  if (parts.at(-1) === '') parts[parts.length - 1] = 'index.html';
  if (parts.some(part => !part || part.startsWith('.'))) return null;
  if (infrastructure.has(parts[0])) return null;
  const file = parts.join('/');
  return contentTypes.has(extname(file).toLowerCase()) ? file : null;
}

export function parseBranchCommit(advertisement, branch) {
  const bytes = Buffer.from(advertisement);
  let offset = 0;
  while (offset < bytes.length) {
    const header = bytes.toString('ascii', offset, offset + 4);
    if (!/^[0-9a-f]{4}$/i.test(header)) throw new Error('Invalid Git reference advertisement');
    const size = Number.parseInt(header, 16);
    offset += 4;
    if (size <= 3) continue; // Git flush, delimiter, and response-end packets.
    if (size < 4 || offset + size - 4 > bytes.length) throw new Error('Truncated Git reference advertisement');
    const line = bytes.toString('utf8', offset, offset + size - 4).split('\0')[0].trimEnd();
    offset += size - 4;
    const separator = line.indexOf(' ');
    const commit = line.slice(0, separator);
    if (/^[a-f0-9]{40}$/.test(commit) && line.slice(separator + 1) === `refs/heads/${branch}`) {
      return commit;
    }
  }
  throw new Error('Configured GitHub branch was not found');
}

export async function resolveBranchCommit(repository, branch, fetchFile = globalThis.fetch) {
  // The public Git protocol endpoint revalidates branch refs on each request.
  // It needs no token and does not consume the REST API's anonymous quota.
  const response = await fetchFile(`https://github.com/${repository}.git/info/refs?service=git-upload-pack`, {
    headers: { 'Git-Protocol': 'version=1', 'Cache-Control': 'no-cache', 'User-Agent': 'lyzr-new-live-site' },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GitHub references returned HTTP ${response.status}`);
  }
  return parseBranchCommit(await response.arrayBuffer(), branch);
}

export function createRequestHandler({
  repository = process.env.SITE_GITHUB_REPOSITORY || 'leano07-oss/lyzr.new',
  branch = process.env.SITE_GITHUB_BRANCH || 'main',
  fetchFile = globalThis.fetch,
  getCommit,
  logger = console,
} = {}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('SITE_GITHUB_REPOSITORY must be owner/repository');
  }
  const latestCommit = getCommit || (() => resolveBranchCommit(repository, branch, fetchFile));

  return async (req, res) => {
    // HTML, assets, and missing pages must all be checked again on refresh.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, message) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(req.method === 'HEAD' ? undefined : message);
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return reply(405, 'Method not allowed.\n');
    }

    const file = resolveFilePath(req.url || '/');
    if (!file) return reply(404, 'Page not found.\n');

    try {
      const commit = await latestCommit();
      if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid GitHub commit');
      res.setHeader('X-Site-Commit', commit);
      // Files are immutable at a commit SHA. A new commit gets a different
      // raw-file URL, so a cached branch URL or old 404 can never hide it.
      const upstreamUrl = new URL(`https://raw.githubusercontent.com/${repository}/${commit}/${file.split('/').map(encodeURIComponent).join('/')}`);
      const headers = {
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'User-Agent': 'lyzr-new-live-site',
      };
      if (req.headers.range) headers.Range = req.headers.range;
      const upstream = await fetchFile(upstreamUrl, {
        method: req.method,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });

      if (!upstream.ok) {
        await upstream.body?.cancel();
        if (upstream.status === 404) return reply(404, 'Page not found. Check the exact filename and folder in GitHub.\n');
        if (upstream.status === 416) return reply(416, 'Requested range is not available.\n');
        logger.error('GitHub file request failed', { file, status: upstream.status });
        res.setHeader('Retry-After', '30');
        return reply(503, 'GitHub is temporarily unavailable. Please try again shortly.\n');
      }

      res.statusCode = upstream.status;
      res.setHeader('Content-Type', contentTypes.get(extname(file).toLowerCase()));
      if (upstream.headers.has('content-range')) {
        res.setHeader('Content-Range', upstream.headers.get('content-range'));
      }
      if (upstream.headers.has('accept-ranges')) {
        res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges'));
      }
      if (req.method === 'HEAD' || !upstream.body) {
        await upstream.body?.cancel();
        return res.end();
      }
      await pipeline(Readable.fromWeb(upstream.body), res);
    } catch (error) {
      logger.error('Unable to load GitHub file', { file, message: error.message });
      if (res.headersSent || res.destroyed) return res.destroy();
      res.setHeader('Retry-After', '30');
      reply(503, 'GitHub is temporarily unavailable. Please try again shortly.\n');
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8080);
  const server = createServer(createRequestHandler());
  server.listen(port, '0.0.0.0', () => {
    console.log(`Live GitHub site listening on 0.0.0.0:${port}`);
  });
  process.on('SIGTERM', () => server.close());
}
