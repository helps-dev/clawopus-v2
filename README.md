# 🐙 CLAWOPUS — Autonomous Memecoin Launcher

Two terminal-style landing pages for an autonomous memecoin launcher agent
(in the spirit of Fable-5), branded **CLAWOPUS THE DEV**.

The agent concept: **reads the timeline → consults the degen oracle → launches a token.**

| Site | Platform | Chain | Theme |
|------|----------|-------|-------|
| `clawopus-nadfun/`   | [nad.fun](https://nad.fun)   | Monad     | purple |
| `clawopus-fourmeme/` | [four.meme](https://four.meme) | BNB Chain | gold |

## Run locally

Each site is fully static (no build step) but ships with a tiny zero-dependency
Node server that also exposes a mock `/api/state` endpoint.

```bash
# nad.fun (Monad) site  →  http://localhost:4173
cd clawopus-nadfun
npm run web

# four.meme (BSC) site  →  http://localhost:4174
cd clawopus-fourmeme
npm run web
```

You can also just open `index.html` directly in a browser — the dashboard runs
on client-side mock data.

## Interactive console

Each site has a real, usable terminal (the `// console` panel). Click it and type:

| command | what it does |
|---------|--------------|
| `help` | list all commands |
| `status` | print agent stats (reads `/api/state` when served, else mock) |
| `scan` | simulate scanning the timeline for narratives |
| `oracle <idea>` | ask the degen oracle for a conviction score |
| `launch <TICKER>` | simulate deploying a memecoin on the platform |
| `ca` | show the contract address |
| `links` | show socials + platform links |
| `about` / `banner` / `whoami` / `date` / `ls` / `echo` | misc |
| `clear` | clear the console (or Ctrl+L) |

Supports command history (↑ / ↓) and Tab auto-complete.

## Project structure

```
clawopus-<platform>/
├── index.html          # terminal landing page
├── assets/
│   ├── styles.css       # chain-themed styling (scanlines, glow, CRT vibe)
│   └── app.js           # boot sequence, copy CA, animated stats, live feed
├── web/
│   └── server.js        # zero-dep static server + /api/state mock
└── package.json         # `npm run web`
```

## Wiring real data

### nad.fun (Monad) — LIVE out of the box ✅

The nad.fun site pulls real data from the public nad.fun indexer
(`https://api.nad.fun`). Just run `npm run web` and the dashboard shows live
network-wide launches (verified: ~28k tokens, real recent launches).

Optional env vars (`clawopus-nadfun`):

| env | effect |
|-----|--------|
| `NADFUN_API_BASE` | indexer base url (default `https://api.nad.fun`) |
| `CLAWOPUS_CREATOR` | a `0x…` wallet — switches stats to **only the tokens that wallet created** (true agent stats) |
| `PORT` | http port (default 4173) |

```bash
# track a specific agent wallet instead of the whole network
set CLAWOPUS_CREATOR=0xYourAgentWallet   # Windows cmd
npm run web
```

Note: `deployed`, `avg score`, and `realized P&L` are **not** exposed by the
public indexer, so they show `—` in live mode (honest by design).

### four.meme (BSC) — LIVE out of the box ✅

four.meme has no clean public no-auth API of its own, so by default the site
pulls **real recent four.meme launches** from the free **GeckoTerminal** public
API (no key) — the `four-meme` DEX on BSC. Just run `npm run web`
(verified: real launches like `super4`, `Alchemyai`, `Taz`, addresses ending in
`…4444`).

Optional env vars (`clawopus-fourmeme`):

| env | effect |
|-----|--------|
| `FOURMEME_PROVIDER` | `geckoterminal` (default) or `custom` |
| `FOURMEME_API_URL` | custom JSON endpoint (when provider=custom) |
| `FOURMEME_API_KEY` | api key for the custom provider |
| `FOURMEME_API_KEY_HEADER` | header name for the key (default `x-api-key`) |
| `PORT` | http port (default 4174) |

Notes for live mode: `today` = new four.meme launches tracked today; the
**total launched count**, `deployed`, `avg score`, and `P&L` aren't exposed by
the free GeckoTerminal API, so they show `—`/`n/a` (honest by design). For
those, switch to a keyed provider (Codex / CoinGecko / Dune / Bitquery) via
`FOURMEME_PROVIDER=custom` + `FOURMEME_API_URL`.

## ⚠️ Disclaimer

These are template marketing/landing pages. Memecoins are extremely high risk.
Nothing here is financial advice. Always verify a contract address independently
before interacting with it. Do not present an autonomous agent's performance as
guaranteed returns.
