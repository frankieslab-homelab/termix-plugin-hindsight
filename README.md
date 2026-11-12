# Termix Plugin: Hindsight

A [Termix](https://github.com/Termix-SSH/Termix) plugin that shows the key metrics of your [Hindsight](https://hindsight.vectorize.io) agent memory in a tab.

## Features

- Service health, round trip time and API version
- Memories, observations, documents and links per bank, with a bank switcher
- Consolidation and background operation queues, with failures highlighted
- Read only: it only calls `GET /health`, `GET /version`, `GET /v1/default/banks` and `GET /v1/default/banks/{bank}/stats`
- The API key stays on the Termix server and is never sent to the browser
- Phone and tablet access through the Termix mobile app's WebView

See [docs/index.md](docs/index.md) for setup and usage.

## Mobile app

Version 0.2.0 and later exposes Hindsight as a WebView in the Termix mobile app
2.0.0 or later, including iOS. Link your Termix server, then open Hindsight under
**From your server** or **Settings > Plugins**. The app must support plugin API
1.13 or later in the 1.x line. The same server-side settings and permissions
apply; no Hindsight key is entered on the phone.

## Install

Releases are published as `.tmxplug` files on the [Releases](../../releases) page. In Termix, turn on Plugin developer mode (Settings, General), open Plugins, and install from a file. Then an admin sets the Hindsight URL, API key and default bank under Settings, Hindsight.

## Development

You need Node 24 and a Termix server you are an admin on. Install the packages, then check your work:

```bash
npm install
npm test
npm run typecheck
npm run build
npm run validate
npm run format:check
```

To try it against a real server, turn on Plugin developer mode in Termix, make an API key under Settings, API keys, and run:

```bash
npx termix-plugin dev --server https://termix.example.com --key tmx_your_key
```

`npm run pack` writes `hindsight-<version>.tmxplug`.

For live verification, follow the [deployment smoke test](docs/index.md#deployment-smoke-test).

## Releasing

Work happens on a `dev-X.Y.Z` branch made from `main`. Add a `## X.Y.Z` section to `CHANGELOG.md`, then run the Release workflow by hand from that branch: beta publishes `X.Y.Z-beta.N`, stable releases `X.Y.Z` and merges the branch into `main`, and dry-run builds without publishing. No secrets are needed. The workflow records GitHub build provenance for the `.tmxplug`.

## License

Apache License 2.0. See [LICENSE](LICENSE).
