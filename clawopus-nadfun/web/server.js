/* ===========================================================
   CLAWOPUS · nad.fun (Monad) — static server + LIVE data
   Pulls real data from the public nad.fun indexer API.

   Docs:  https://api-server.nad.fun/swagger-ui
   REST:  https://api-server.nad.fun
   WSS:   wss://api-server.nad.fun/wss

   Run:   npm run web   (or: node web/server.js)

   Env (all optional):
     PORT                http port (default 4173)
     NADFUN_API_BASE     indexer base url (default https://api-server.nad.fun)
     CLAWOPUS_CREATOR    agent wallet (0x...) — if set, /api/state reports the
                         tokens THIS wallet actually created (true agent stats).
                         If unset, it reports network-wide nad.fun activity.
   =========================================================== */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 4173;
const API_BASE = (process.env.NADFUN_API_BASE || "https://api.nad.fun").replace(/\/$/, "");
const CREATOR = (process.env.CLAWOPUS_CREATOR || "").trim();
const CURRENCY = "MON";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/* ---------- tiny fetch helper with timeout ---------- */
async function fetchJson(url, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "clawopus/1.0" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* ---------- defensive field extraction ---------- */
function pick(obj, keys, dflt) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return dflt;
}

// nad.fun list items look like { token_info: {...}, market_info: {...} }.
// `creator` is an object: { account_id, nickname, ... }. created_at is unix seconds.
function normToken(item) {
  const ti = item.token_info || item.token || item;
  const mi = item.market_info || item.market || {};
  const creatorRaw = ti.creator;
  const creator = typeof creatorRaw === "object" && creatorRaw
    ? pick(creatorRaw, ["account_id", "address"], "")
    : (creatorRaw || "");
  return {
    name: pick(ti, ["name"], "?"),
    symbol: pick(ti, ["symbol", "ticker"], "?"),
    address: pick(ti, ["token_id", "token", "address", "id"], ""),
    creator: String(creator).toLowerCase(),
    createdAt: Number(pick(ti, ["created_at", "createdAt", "create_time"], 0)),
    priceUsd: Number(pick(mi, ["price_usd"], 0)),
    marketType: pick(mi, ["market_type", "marketType"], ""),
    isGraduated: !!pick(ti, ["is_graduated"], false),
  };
}

function startOfTodayUtc() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

async function fetchOrderPage(orderType, page, limit) {
  const url = `${API_BASE}/order/${orderType}?page=${page}&limit=${limit}`;
  const data = await fetchJson(url);
  const list = (data.tokens || data.order_token || data.data || []).map(normToken);
  const total = Number(pick(data, ["total_count", "totalCount", "total"], list.length));
  return { list, total };
}

/* ---------- build live state ---------- */
async function buildLiveState() {
  const today = startOfTodayUtc();

  // Agent scope: scan recent creations and keep only this wallet's tokens.
  if (CREATOR) {
    const want = CREATOR.toLowerCase();
    let mine = [];
    for (let page = 1; page <= 5; page++) {
      const { list } = await fetchOrderPage("creation_time", page, 100);
      if (!list.length) break;
      mine = mine.concat(list.filter((t) => t.creator === want));
      // stop early once we've paged past today's window for efficiency
      if (list[list.length - 1].createdAt < today && mine.length) break;
    }
    return {
      scope: "agent",
      creator: CREATOR,
      launched: mine.length,
      today: mine.filter((t) => t.createdAt >= today).length,
      recent: mine.slice(0, 6),
    };
  }

  // Network scope: latest creations across all of nad.fun.
  const { list, total } = await fetchOrderPage("creation_time", 1, 50);
  return {
    scope: "network",
    launched: total,
    today: list.filter((t) => t.createdAt >= today).length,
    recent: list.slice(0, 6),
  };
}

/* ---------- mock fallback ---------- */
function mockState(reason) {
  return {
    chain: "Monad",
    platform: "nad.fun",
    currency: CURRENCY,
    scope: "mock",
    live: false,
    note: reason || "live data unavailable — showing placeholder",
    level: 7,
    launched: 42,
    today: 6,
    deployed: 318.7,
    avgScore: 0.74,
    realizedPnl: "+128.4 " + CURRENCY,
    status: "offline",
    recent: [],
    updatedAt: new Date().toISOString(),
  };
}

/* ---------- 15s cache ---------- */
let cache = { at: 0, payload: null };
async function getState() {
  const now = Date.now();
  if (cache.payload && now - cache.at < 15000) return cache.payload;
  let payload;
  try {
    const live = await buildLiveState();
    payload = {
      chain: "Monad",
      platform: "nad.fun",
      currency: CURRENCY,
      live: true,
      status: "online",
      level: 7,
      launched: live.launched,
      today: live.today,
      scope: live.scope,
      creator: live.creator,
      recent: live.recent,
      note:
        live.scope === "network"
          ? "network-wide nad.fun launches (set CLAWOPUS_CREATOR for agent-only stats)"
          : "real tokens created by the agent wallet",
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    payload = mockState("indexer error: " + e.message);
  }
  cache = { at: now, payload };
  return payload;
}

/* ---------- static + api server ---------- */
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
  console.log("  \u001b[35m🐙 CLAWOPUS THE DEV\u001b[0m — Autonomous Memecoin Launch System");
  console.log("  reads the timeline · consults the degen oracle · launches on nad.fun (Monad)");
  console.log("");
  console.log(`  web ui  →  http://localhost:${PORT}`);
  console.log(`  api     →  http://localhost:${PORT}/api/state`);
  console.log(`  source  →  ${API_BASE}` + (CREATOR ? `  (agent wallet ${CREATOR})` : "  (network-wide)"));
  console.log("");
});
