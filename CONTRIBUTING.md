# Contributing

Thank you for forking GlobeWatch. This is a civic OSINT instrument panel, not an official government product. Keep sources visible, keep numbers honest, and do not commit secrets.

## Run it

Requires **Node 20** and npm. No private keys are required.

```bash
git clone https://github.com/Nonarkara/globalmonitor-v3.git
cd globalmonitor-v3
npm install
npm run dev:stack
```

That starts Vite at `http://127.0.0.1:5180` and the cache API at `http://127.0.0.1:4000`. Vite proxies `/api` to the API. Optional keys go in `.env.local` copied from [`.env.example`](.env.example); leave them empty and the UI still renders public fallbacks and committed snapshots.

## Before you open a pull request

```bash
npm test
npm run lint
npm run build
```

CI on `main` runs the same three commands plus `npm audit`.

## What we accept

- Real data, labelled sources, and measured-vs-modelled honesty. A figure without a source or an age is a defect.
- Fixes that keep the Rams instrument-panel system: paper, one Braun-green signal colour, hairline cells, no glass, no second hue. See [`docs/RAMS-STYLE.md`](docs/RAMS-STYLE.md).
- Changes that work for a stranger who only ran `npm install` and `npm run dev:stack`.

## What we reject

- Secrets, tokens, or filled `.env*` files. Bind production keys in the host dashboard, never as `VITE_*`.
- Placeholder numbers, silent `return null` holes, or copy that presents this dashboard as official intelligence.
- Dark-theme / glass / gradient reverts, extra accent colours, or a second logo strip.

## How to send a change

1. Fork (or branch from `main` if you have write access).
2. Keep the change small and say what a stranger can now do.
3. Open a pull request against `main`. Link an issue when one exists.

Questions about ethical reuse: [README §3](README.md#3-ethical-use). Security reports: [SECURITY.md](SECURITY.md).
