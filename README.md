# lyzr.new

A static Lyzr AI case study site. Open `index.html` for the homepage; the seven original case studies are in `case-study/`.

No package installation, build step, database, or sign-in service is required.

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

## Preview in Alpha

From this repository's directory:

```sh
forge serve start web --port 8080 --default -- python3 -m http.server 8080 --bind 0.0.0.0
```

The app appears in the Preview tab on port 8080.

## Deploy in Alpha

Check the build configuration:

```sh
forge deploy check --dir . --name lyzr-new
```

When ready to publish, use the Deploy tab or run:

```sh
forge deploy --dir . --name lyzr-new --port 8080 --no-database --no-auth
```

Alpha detects the root `index.html` as a static site and serves it with Caddy. Deployment prints the public HTTPS address to share. Running the deploy command again publishes the current workspace changes to the same service. GitHub pushes and Alpha deployments are separate actions.
