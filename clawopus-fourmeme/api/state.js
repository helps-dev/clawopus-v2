/* ===========================================================
   CLAWOPUS · four.meme (BNB Chain) — Vercel Serverless Function
   Endpoint: /api/state

   On Vercel the long-running web/server.js does NOT run. Vercel
   serves the static files and turns every file in /api into a
   serverless function, so this provides the live /api/state in prod.

   By default it pulls REAL four.meme launches from the free
   GeckoTerminal public API (no key). Override via env vars.

   Env (optional, set in Vercel → Project → Settings → Environment):
     FOURMEME_PROVIDER        "geckoterminal" (default) | "custom"
     FOURMEME_API_URL         custom JSON endpoint (provider=custom)
     FOURMEME_API_KEY         api key for the custom provider
     FOURMEME_API_KEY_HEADER  header name for the key (default x-api-key)
   =========================================================== */
"use strict";

const PROVIDER = (process.env.FOURMEME_PROVIDER || "geckoterminal").trim().toLowerCase();
const API_URL = (process.env.FOURMEME_API_URL || "").trim();
const API_KEY = (process.env.FOURMEME_API_KEY || "").trim();
const API_KEY_HEADER = (process.env.FOURMEME_API_KEY_HEADER || "x-api-key").trim();
const CURRENCY = "BNB";

const GECKO_URL =
  "https://api.geckoterminal.com/api/v2/networks/bsc/dexes/four-meme/pools?include=base_token&page=1";

async function fetchJson(url, ms = 9000, extraHeaders) {
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

async function buildFromGecko() {
  const data = await fetchJson(GECKO_URL);
  const pools = Array.isArray(data.data) ? data.data : [];
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
    const createdAt = a.pool_created_at ? Math.floor(Date.parse(a.pool_created_at) / 1000) : 0;
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
  recent.sort((a, b) => b.createdAt - a.createdAt);
  return {
    scope: "four-meme · geckoterminal",
    launched: null,
    today: recent.filter((t) => t.createdAt >= today).length,
    recent: recent.slice(0, 8),
    note: "live recent four.meme launches via GeckoTerminal (free public API). total count / P&L not exposed.",
  };
}

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
  const data = await fetchJson(API_URL, 9000, headers);
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
    chain: "BNB Chain", platform: "four.meme", currency: CURRENCY,
    scope: "mock", live: false, note: reason || "live data unavailable",
    level: 7, launched: 57, today: 9, deployed: 41.6, avgScore: 0.71,
    realizedPnl: "+19.2 " + CURRENCY, status: "offline", recent: [],
    updatedAt: new Date().toISOString(),
  };
}

module.exports = async (req, res) => {
  let payload;
  try {
    const live = await buildLiveState();
    payload = {
      chain: "BNB Chain", platform: "four.meme", currency: CURRENCY,
      live: true, status: "online", level: 7,
      launched: live.launched, today: live.today, scope: live.scope,
      recent: live.recent, note: live.note, updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    payload = mockState("provider error: " + e.message);
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  res.statusCode = 200;
  res.end(JSON.stringify(payload, null, 2));
};
