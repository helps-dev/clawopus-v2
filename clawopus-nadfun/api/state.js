/* ===========================================================
   CLAWOPUS · nad.fun (Monad) — Vercel Serverless Function
   Endpoint: /api/state

   On Vercel the long-running web/server.js does NOT run (that's
   only for `npm run web` locally). Vercel serves the static files
   and turns every file in /api into a serverless function, so this
   file provides the live /api/state endpoint in production.

   Env (optional, set in Vercel → Project → Settings → Environment):
     NADFUN_API_BASE    indexer base url (default https://api.nad.fun)
     CLAWOPUS_CREATOR   agent wallet 0x… → report only that wallet's tokens
   =========================================================== */
"use strict";

const API_BASE = (process.env.NADFUN_API_BASE || "https://api.nad.fun").replace(/\/$/, "");
const CREATOR = (process.env.CLAWOPUS_CREATOR || "").trim();
const CURRENCY = "MON";

async function fetchJson(url, ms = 8000) {
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

function pick(obj, keys, dflt) {
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  return dflt;
}

function normToken(item) {
  const ti = item.token_info || item.token || item;
  const mi = item.market_info || item.market || {};
  const creatorRaw = ti.creator;
  const creator =
    typeof creatorRaw === "object" && creatorRaw ? pick(creatorRaw, ["account_id", "address"], "") : creatorRaw || "";
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
  const data = await fetchJson(`${API_BASE}/order/${orderType}?page=${page}&limit=${limit}`);
  const list = (data.tokens || data.order_token || data.data || []).map(normToken);
  const total = Number(pick(data, ["total_count", "totalCount", "total"], list.length));
  return { list, total };
}

async function buildLiveState() {
  const today = startOfTodayUtc();
  if (CREATOR) {
    const want = CREATOR.toLowerCase();
    let mine = [];
    for (let page = 1; page <= 5; page++) {
      const { list } = await fetchOrderPage("creation_time", page, 100);
      if (!list.length) break;
      mine = mine.concat(list.filter((t) => t.creator === want));
      if (list[list.length - 1].createdAt < today && mine.length) break;
    }
    return {
      scope: "agent",
      creator: CREATOR,
      launched: mine.length,
      today: mine.filter((t) => t.createdAt >= today).length,
      recent: mine.slice(0, 6),
      note: "real tokens created by the agent wallet",
    };
  }
  const { list, total } = await fetchOrderPage("creation_time", 1, 50);
  return {
    scope: "network",
    launched: total,
    today: list.filter((t) => t.createdAt >= today).length,
    recent: list.slice(0, 6),
    note: "network-wide nad.fun launches (set CLAWOPUS_CREATOR for agent-only stats)",
  };
}

function mockState(reason) {
  return {
    chain: "Monad", platform: "nad.fun", currency: CURRENCY,
    scope: "mock", live: false, note: reason || "live data unavailable",
    level: 7, launched: 42, today: 6, deployed: 318.7, avgScore: 0.74,
    realizedPnl: "+128.4 " + CURRENCY, status: "offline", recent: [],
    updatedAt: new Date().toISOString(),
  };
}

module.exports = async (req, res) => {
  let payload;
  try {
    const live = await buildLiveState();
    payload = {
      chain: "Monad", platform: "nad.fun", currency: CURRENCY,
      live: true, status: "online", level: 7,
      launched: live.launched, today: live.today, scope: live.scope,
      creator: live.creator, recent: live.recent, note: live.note,
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    payload = mockState("indexer error: " + e.message);
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  // let Vercel's edge cache the response for 15s (and serve stale while revalidating)
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  res.statusCode = 200;
  res.end(JSON.stringify(payload, null, 2));
};
