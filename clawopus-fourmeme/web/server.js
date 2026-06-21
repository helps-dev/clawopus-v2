/* ===========================================================
   CLAWOPUS · four.meme (BNB Chain) — static server + LIVE data

   four.meme has no clean public no-auth API of its own, so by
   default this server pulls REAL four.meme launches from the free
   GeckoTerminal public API (no API key required):

     https://api.geckoterminal.com/api/v2/networks/bsc/dexes/four-meme/pools

   You can override with any other provider via env vars.

   Run:  npm run web   (or: node web/server.js)

   Env (all optional):
     PORT                    http port (default 4174)
     FOURMEME_PROVIDER       "geckoterminal" (default) | "custom"
     FOURMEME_API_URL        custom JSON endpoint returning a token list
                             (used when FOURMEME_PROVIDER=custom)
     FOURMEME_API_KEY        api key for the custom provider (optional)
     FOURMEME_API_KEY_HEADER header name for the key (default x-api-key)
   =========================================================== */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 4174;
const PROVIDER = (process.env.FOURMEME_PROVIDER || "geckoterminal").trim().toLowerCase();
const API_URL = (process.env.FOURMEME_API_URL || "").trim();
const API_KEY = (process.env.FOURMEME_API_KEY || "").trim();
const API_KEY_HEADER = (process.env.FOURMEME_API_KEY_HEADER || "x-api-key").trim();
const CURRENCY = "BNB";

const GECKO_URL =
  "https://api.geckoterminal.com/api/v2/networks/bsc/dexes/four-meme/pools" +
  "?include=base_token&page=1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function fetchJson(url, ms = 8000, extraHeaders) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const headers = Object.assign({ accept: "application/json", "user-agent": "clawopus/1.0" }, extraHeaders || {});
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function pick(obj, keys, dflt) {
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  return dflt;
}

function startOfTodayUtc() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

/* ---------- GeckoTerminal provider (default, no key) ---------- */
async function buildFromGecko() {
  const data = await fetchJson(GECKO_URL);
  const pools = Array.isArray(data.data) ? data.data : [];
  // map included base tokens by id → { name, symbol, address }
  const tokById = {};
  (data.included || []).forEach((inc) => {
    if (inc && inc.type === "token") {
      tokById[inc.id] = {
        name: pick(inc.attributes, ["name"], ""),
        symbol: pick(inc.attributes, ["symbol"], ""),
        address: pick(inc.attributes, ["address"], ""),
      };
    }
  });

  const recent = pools.map((p) => {
    const a = p.attributes || {};
    const baseId = p.relationships && p.relationships.base_token && p.relationships.base_token.data && p.relationships.base_token.data.id;
    const tok = (baseId && tokById[baseId]) || {};
    const createdIso = a.pool_created_at;
    const createdAt = createdIso ? Math.floor(Date.parse(createdIso) / 1000) : 0;
    // pool name looks like "SYMBOL / BNB" — use base token data when available
    const fallbackSym = String(a.name || "").split("/")[0].trim();
    return {
      name: tok.name || fallbackSym || "?",
      symbol: tok.symbol || fallbackSym || "?",
      address: tok.address || (baseId ? baseId.replace(/^bsc_/, "") : a.address || ""),
      createdAt,
      priceUsd: Number(a.base_token_price_usd || 0),
      fdvUsd: Number(a.fdv_usd || 0),
    };
  });

  const today = startOfTodayUtc();
  recent.sort((a, b) => b.createdAt - a.createdAt); // newest first
  return {
    scope: "four-meme · geckoterminal",
    launched: null, // total token count not exposed by the free API
    today: recent.filter((t) => t.createdAt >= today).length,
    recent: recent.slice(0, 8),
    note: "live recent four.meme launches via GeckoTerminal (free public API). total count / P&L not exposed.",
  };
}

/* ---------- generic custom provider ---------- */
function extractList(data) {
  if (Array.isArray(data)) return data;
  const c = [data.tokens, data.data, data.result, data.items, data.list, data.records];
  for (const x of c) if (Array.isArray(x)) return x;
  if (data.data && Array.isArray(data.data.tokens)) return data.data.tokens;
  return [];
}
function normCustom(item) {
  return {
    name: String(pick(item, ["name", "tokenName", "title"], "?")),
    symbol: String(pick(item, ["symbol", "ticker", "tokenSymbol"], "?")),
    address: String(pick(item, ["address", "contract", "contractAddress", "tokenAddress", "id"], "")),
    createdAt: Number(pick(item, ["createdAt", "created_at", "createTime", "timestamp"], 0)),
  };
}
async function buildFromCustom() {
  const headers = API_KEY ? { [API_KEY_HEADER]: API_KEY } : undefined;
  const data = await fetchJson(API_URL, 8000, headers);
  const list = extractList(data).map(normCustom);
  const total = Number(pick(data, ["total", "total_count", "totalCount", "count"], list.length));
  return { scope: "four-meme · custom", launched: total, today: list.length, recent: list.slice(0, 8), note: "live data via custom provider" };
}

async function buildLiveState() {
  if (PROVIDER === "custom") {
    if (!API_URL) throw new Error("FOURMEME_PROVIDER=custom but FOURMEME_API_URL is not set");
    return buildFromCustom();
  }
  return buildFromGecko();
}

function mockState(reason) {
  return {
    chain: "BNB Chain",
    platform: "four.meme",
    currency: CURRENCY,
    scope: "mock",
    live: false,
    note: reason || "live data unavailable — showing placeholder",
    level: 7,
    launched: 57,
    today: 9,
    deployed: 41.6,
    avgScore: 0.71,
    realizedPnl: "+19.2 " + CURRENCY,
    status: "offline",
    recent: [],
    updatedAt: new Date().toISOString(),
  };
}

let cache = { at: 0, payload: null };
async function getState() {
  const now = Date.now();
  if (cache.payload && now - cache.at < 15000) return cache.payload;
  let payload;
  try {
    const live = await buildLiveState();
    payload = {
      chain: "BNB Chain",
      platform: "four.meme",
      currency: CURRENCY,
      live: true,
      status: "online",
      level: 7,
      launched: live.launched,
      today: live.today,
      scope: live.scope,
      recent: live.recent,
      note: live.note,
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    payload = mockState("provider error: " + e.message);
  }
  cache = { at: now, payload };
  return payload;
}

function safeJoin(base, target) {
  const p = path.normalize(path.join(base, target));
  return p.startsWith(base) ? p : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/state") {
    const state = await getState();
    res.writeHead(200, { "Content-Type": MIME[".json"], "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(state, null, 2));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = safeJoin(ROOT, pathname);
  if (!filePath) { res.writeHead(400); res.end("bad request"); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": MIME[".html"] });
      res.end("<h1>404</h1><p>not found</p>");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("  \u001b[33m🐙 CLAWOPUS THE DEV\u001b[0m — Autonomous Memecoin Launch System");
  console.log("  reads the timeline · consults the degen oracle · launches on four.meme (BSC)");
  console.log("");
  console.log(`  web ui  →  http://localhost:${PORT}`);
  console.log(`  api     →  http://localhost:${PORT}/api/state`);
  console.log("  source  →  " + (PROVIDER === "custom" ? API_URL : "GeckoTerminal four-meme (BSC) · free public API"));
  console.log("");
});
