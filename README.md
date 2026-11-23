# lyzr.new

A Lyzr AI website whose public pages and assets load directly from this public GitHub repository's `main` branch.

The hosting server uses Node.js 22 with no external packages, build step, database, or sign-in service.

## Live site

**[lyzr-new.alpha.site](https://lyzr-new.alpha.site/)**

Every case study is available directly under the same public address:

- [Venture screening](https://lyzr-new.alpha.site/case-study/venture-screening.html)
- [Agentic procurement](https://lyzr-new.alpha.site/case-study/agentic-procurement.html)
- [Payments support automation](https://lyzr-new.alpha.site/case-study/payments-support-automation.html)
- [Telecom order automation](https://lyzr-new.alpha.site/case-study/telecom-order-automation.html)
- [Hotel reputation management](https://lyzr-new.alpha.site/case-study/hotel-reputation-management.html)
- [Innovation idea evaluation](https://lyzr-new.alpha.site/case-study/innovation-idea-evaluation.html)
- [CPG AI governance](https://lyzr-new.alpha.site/case-study/cpg-ai-governance.html)

Other pages include [Contact](https://lyzr-new.alpha.site/lyzr-contact.html) and [Wall of Love](https://lyzr-new.alpha.site/wall-of-love-lyzr.html).

## Publish pages automatically

Add or edit an HTML file in GitHub and commit it to **main**. Its address is `https://lyzr-new.alpha.site/` plus the exact repository path. For example, `lyzr-contact.html` opens at `https://lyzr-new.alpha.site/lyzr-contact.html`, and `case-study/new-story.html` opens at `https://lyzr-new.alpha.site/case-study/new-story.html`.

Refresh the page after GitHub finishes saving the commit. Page changes, newly added pages, deleted pages, CSS, JavaScript, images, fonts, and other supported static assets are read from GitHub on each request. No chat request, workflow, manual deployment, or running Alpha session is needed for these content updates. Changes in a branch other than `main` appear after merging it into `main`.

The server fetches the public raw file with a fresh cache key and sends `Cache-Control: no-store`, including for missing pages, so a previous visit does not cache an old page or a 404. Relative asset paths continue to work. `/` maps to `index.html`; a path ending in `/` maps to that folder's `index.html`. Filenames and folder names are case-sensitive.

This is live file serving from GitHub, rather than a new deployment for every commit. The repository must remain public and GitHub must be reachable. Code that needs compilation, private repositories, and backend handlers are outside this static publishing setup. Changes to `server.mjs` or `package.json` still require an Alpha redeployment.

## Preview in Alpha

From this repository's directory:

```sh
forge serve start web --port 8080 --default -- npm start
```

The app appears in the Preview tab on port 8080 and reads the live GitHub branch. To preview uncommitted HTML edits locally instead, use a separate static preview:

```sh
forge serve start local-files --port 8081 -- python3 -m http.server 8081 --bind 0.0.0.0
```

Run server tests with `npm test`.

## Deploy in Alpha

Check the build configuration:

```sh
forge deploy check --dir . --name lyzr-new
```

When ready to publish, use the Deploy tab or run:

```sh
forge deploy --dir . --name lyzr-new --port 8080 --no-database --no-auth
```

Alpha detects `package.json` and starts `node server.mjs` on `$PORT`, bound to `0.0.0.0`. Deploying again updates the hosting server at the same public address; page and asset commits already appear automatically without redeploying.

Optional server configuration: `SITE_GITHUB_REPOSITORY` defaults to `leano07-oss/lyzr.new` and `SITE_GITHUB_BRANCH` defaults to `main`. No GitHub token is used or needed.
