/* ===========================================================
   CLAWOPUS · four.meme (BNB Chain) — front-end logic
   Pure client-side simulation. Swap mock data for a real
   /api feed (see web/server.js) when wiring a backend.
   =========================================================== */
(function () {
  "use strict";

  const CONFIG = {
    chain: "BNB Chain",
    platform: "four.meme",
    currency: "BNB",
    twitter: "https://x.com/",
    telegram: "https://t.me/",
    explorer: "https://bscscan.com/",
    ca: "0x0000000000000000000000000000000000000000",
  };

  /* ---------- Boot sequence ---------- */
  const bootLines = [
    "clawopus boot loader v1.0.0",
    "[ ok ] mounting /the-dev",
    "[ ok ] loading claude reasoning core",
    "[ ok ] connecting to BSC RPC ............. online",
    "[ ok ] linking four.meme deployer ........ ready",
    "[ ok ] subscribing to timeline stream .... live",
    "[ ok ] waking the degen oracle ........... awake",
    "",
    "  🐙 CLAWOPUS THE DEV — autonomous memecoin launcher",
    "  npm run web  →  node web/server.js",
    "",
    "starting web ui ...",
  ];

  function runBoot() {
    const boot = document.getElementById("boot");
    const log = document.getElementById("boot-log");
    if (!boot || !log) return Promise.resolve();
    let i = 0;
    return new Promise((resolve) => {
      const tick = () => {
        if (i < bootLines.length) {
          log.textContent += (i ? "\n" : "") + bootLines[i];
          i++;
          setTimeout(tick, 90 + Math.random() * 120);
        } else {
          setTimeout(() => {
            boot.classList.add("done");
            resolve();
          }, 450);
        }
      };
      tick();
    });
  }

  /* ---------- Copy CA ---------- */
  function wireCopy() {
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const sel = btn.getAttribute("data-copy");
        const el = document.querySelector(sel);
        if (!el) return;
        try {
          await navigator.clipboard.writeText(el.textContent.trim());
          const prev = btn.textContent;
          btn.textContent = "copied ✓";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove("copied");
          }, 1500);
        } catch (e) {
          btn.textContent = "ctrl+c";
        }
      });
    });
  }

  /* ---------- Social links ---------- */
  function wireLinks() {
    const x = document.getElementById("x-link");
    const tg = document.getElementById("tg-link");
    if (x) x.href = CONFIG.twitter;
    if (tg) tg.href = CONFIG.telegram;
  }

  /* ---------- Animated stat counters ---------- */
  function animateValue(el, to, opts = {}) {
    const dur = opts.dur || 1400;
    const decimals = opts.decimals || 0;
    const prefix = opts.prefix || "";
    const suffix = opts.suffix || "";
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = (to * eased).toFixed(decimals);
      el.textContent = prefix + Number(val).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  async function fillStats() {
    let s = null;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) s = await res.json();
    } catch (e) { /* file:// or offline */ }

    const badge = document.getElementById("status-badge");
    const live = s && s.live;
    if (badge) {
      badge.innerHTML = '<span class="dot"></span> ' + (live ? "online · live" : "offline · demo");
      if (!live) badge.querySelector(".dot").style.background = "var(--dim)";
    }

    const data = live
      ? { launched: s.launched == null ? null : Number(s.launched), today: Number(s.today) || 0, deployed: null, score: null }
      : { launched: 57, today: 9, deployed: 41.6, score: 0.71 };

    const set = (name, fn) => {
      const el = document.querySelector(`[data-stat="${name}"]`);
      if (el) fn(el);
    };
    set("launched", (el) => (data.launched == null ? (el.textContent = "—") : animateValue(el, data.launched)));
    set("today", (el) => animateValue(el, data.today));
    set("deployed", (el) =>
      data.deployed == null ? (el.textContent = "—") : animateValue(el, data.deployed, { decimals: 1, suffix: " " + CONFIG.currency })
    );
    set("score", (el) => (data.score == null ? (el.textContent = "—") : animateValue(el, data.score, { decimals: 2 })));
    set("pnl", (el) => {
      if (live) { el.textContent = "—"; }
      else { el.textContent = "+19.2 " + CONFIG.currency; el.classList.add("up"); }
    });

    const noteEl = document.querySelector("[data-scope-note]");
    if (noteEl) {
      if (live) {
        noteEl.textContent = "↑ live recent four.meme launches via GeckoTerminal. 'today' = new launches tracked today; total / deployed / score / P&L aren't exposed by the free API.";
      } else {
        noteEl.textContent = "↑ demo data — run `npm run web` for live four.meme launches.";
      }
    }

    return s;
  }

  /* ---------- Live feed simulation ---------- */
  const TICKERS = ["BNBCAT", "GOLD", "GMBNB", "FOURX", "OCTO", "WAGBNB", "DEGEN", "PEPEBNB", "BLOB", "CLAW"];
  const NARR = [
    "bsc memecoin szn heating up",
    "ct calling a golden bull run",
    "new four.meme volume ATH detected",
    "octopus meta trending on the TL",
    "whale wallet rotating into memes",
    "ticker velocity > threshold",
  ];

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function clock() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function shortAddr() {
    const hex = "0123456789abcdef";
    let s = "0x";
    for (let i = 0; i < 4; i++) s += hex[Math.floor(Math.random() * 16)];
    return s + "…" + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
  }

  function feedLine() {
    const roll = Math.random();
    const t = `<span class="t">[${clock()}]</span> `;
    if (roll < 0.34) {
      return t + `<span class="acc">scan</span> ${rand(NARR)}`;
    } else if (roll < 0.62) {
      const score = (0.4 + Math.random() * 0.6).toFixed(2);
      return t + `oracle scored <span class="acc">$${rand(TICKERS)}</span> → conviction <span class="warn">${score}</span>`;
    } else if (roll < 0.82) {
      const score = (0.7 + Math.random() * 0.3).toFixed(2);
      return t + `<span class="ok">launch</span> deployed <span class="acc">$${rand(TICKERS)}</span> on ${CONFIG.platform} · ${(0.2 + Math.random() * 1.6).toFixed(2)} ${CONFIG.currency} seeded · score ${score}`;
    } else {
      return t + `tx ${shortAddr()} confirmed on ${CONFIG.chain}`;
    }
  }

  function runFeed(state) {
    const log = document.getElementById("feed-log");
    const clk = document.getElementById("feed-clock");
    if (!log) return;
    if (clk) setInterval(() => (clk.textContent = clock()), 1000);

    const live = state && state.live;
    const seen = new Set();

    function pushToken(t, tag) {
      if (!t || !t.address || seen.has(t.address)) return;
      seen.add(t.address);
      const when = t.createdAt ? new Date(t.createdAt * 1000) : new Date();
      const ts = pad(when.getHours()) + ":" + pad(when.getMinutes()) + ":" + pad(when.getSeconds());
      appendFeed(
        log,
        `<span class="t">[${ts}]</span> <span class="ok">${tag}</span> $${escapeHtml(t.symbol || "?")} <span class="acc">${escapeHtml(t.name || "")}</span> · ${String(t.address).slice(0, 8)}… on ${CONFIG.platform}`
      );
    }

    if (live) {
      appendFeed(log, `<span class="t">[${clock()}]</span> <span class="muted">watching four.meme for new launches…</span>`);
      (state.recent || []).slice().reverse().forEach((t) => pushToken(t, "new"));
      async function poll() {
        try {
          const res = await fetch("/api/state", { cache: "no-store" });
          if (!res.ok) return;
          const s = await res.json();
          (s.recent || []).slice().reverse().forEach((t) => pushToken(t, "new"));
        } catch (e) { /* ignore transient errors */ }
      }
      setInterval(poll, 12000);
    } else {
      appendFeed(log, `<span class="t">[${clock()}]</span> <span class="warn">demo feed — set FOURMEME_API_URL + run \`npm run web\` for real launches</span>`);
      for (let i = 0; i < 5; i++) appendFeed(log, feedLine());
      setInterval(() => appendFeed(log, feedLine()), 2200 + Math.random() * 1800);
    }
  }

  function appendFeed(log, html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    log.appendChild(div);
    while (log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  /* ---------- Interactive terminal ---------- */
  const HISTORY = [];
  let histIdx = -1;
  let termBusy = false;

  const COMMANDS = ["help", "status", "scan", "oracle", "launch", "ca", "links", "about", "banner", "clear", "echo", "whoami", "date", "ls"];

  function termPrint(html, cls) {
    const out = document.getElementById("term-out");
    if (!out) return;
    const div = document.createElement("div");
    div.className = "line" + (cls ? " " + cls : "");
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function termPrintSlow(lines, delay) {
    for (const l of lines) {
      termPrint(l.text, l.cls);
      await sleep(delay || 320);
    }
  }

  const HANDLERS = {
    help() {
      termPrint("available commands:", "acc");
      termPrint(
        "  help              show this help\n" +
        "  status            print agent stats\n" +
        "  scan              scan the timeline for narratives\n" +
        "  oracle &lt;idea&gt;     ask the degen oracle for a conviction score\n" +
        "  launch &lt;TICKER&gt;   deploy a memecoin on " + CONFIG.platform + "\n" +
        "  ca                show the contract address\n" +
        "  links             show socials + platform links\n" +
        "  about             what is clawopus\n" +
        "  banner            redraw the logo\n" +
        "  whoami / date / ls / echo\n" +
        "  clear             clear the console",
        "muted"
      );
    },
    about() {
      termPrint("🐙 CLAWOPUS THE DEV", "acc");
      termPrint("autonomous memecoin launcher built on Claude.");
      termPrint("reads the timeline · consults the degen oracle · launches on " + CONFIG.platform + " (" + CONFIG.chain + ").");
    },
    async status() {
      termPrint("querying four.meme data provider ...", "muted");
      let s = null;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.ok) s = await res.json();
      } catch (e) { /* offline / file:// — fall back to mock */ }
      if (!s) {
        termPrint("no server — run `npm run web` for live data. showing demo:", "warn");
        s = { live: false, level: 7, launched: 57, today: 9, scope: "mock" };
      }
      const na = s.live ? "n/a (not in provider feed)" : "—";
      termPrint(
        "  source        " + (s.live ? "LIVE · " + (s.scope || "provider") : "demo / mock") + "\n" +
        "  status        " + (s.status || (s.live ? "online" : "offline")) + "\n" +
        "  launched      " + (s.launched == null ? "n/a (free API)" : s.launched) + "\n" +
        "  today         " + (s.today ?? 0) + "\n" +
        "  deployed      " + (s.live ? na : (s.deployed ?? "—") + " " + CONFIG.currency) + "\n" +
        "  avg score     " + (s.live ? na : (s.avgScore ?? "—")) + "\n" +
        "  realized P&L  " + (s.live ? na : (s.realizedPnl ?? "—")),
        s.live ? "ok" : "warn"
      );
      if (s.note) termPrint("  note: " + escapeHtml(s.note), "muted");
      if (Array.isArray(s.recent) && s.recent.length) {
        termPrint("recent launches:", "acc");
        s.recent.slice(0, 6).forEach((t) => {
          termPrint("  $" + escapeHtml(t.symbol || "?") + "  " + escapeHtml(t.name || "") + "  " + (t.address ? t.address.slice(0, 10) + "…" : ""), "muted");
        });
      }
    },
    async scan() {
      await termPrintSlow([
        { text: "streaming X + " + CONFIG.chain + " timeline ...", cls: "muted" },
        { text: "→ " + rand(NARR), cls: "acc" },
        { text: "→ " + rand(NARR), cls: "acc" },
        { text: "scoring narratives by velocity · novelty · meme potential", cls: "muted" },
        { text: "done. " + (2 + Math.floor(Math.random() * 5)) + " candidates queued for the oracle.", cls: "ok" },
      ], 360);
    },
    async oracle(args) {
      const idea = args.join(" ").trim();
      if (!idea) { termPrint("usage: oracle &lt;your meme idea&gt;", "warn"); return; }
      await termPrintSlow([
        { text: 'consulting the degen oracle on "' + escapeHtml(idea) + '" ...', cls: "muted" },
        { text: "reasoning ......", cls: "muted" },
      ], 420);
      const score = (0.35 + Math.random() * 0.6).toFixed(2);
      const verdict = score >= 0.7 ? "SEND IT" : score >= 0.5 ? "watchlist" : "pass";
      const cls = score >= 0.7 ? "ok" : score >= 0.5 ? "warn" : "err";
      termPrint("conviction score: " + score + "  →  " + verdict, cls);
    },
    async launch(args) {
      let ticker = (args[0] || rand(TICKERS)).replace(/^\$/, "").toUpperCase().slice(0, 10);
      await termPrintSlow([
        { text: "preparing launch of $" + escapeHtml(ticker) + " on " + CONFIG.platform + " ...", cls: "muted" },
        { text: "  ↳ generating metadata + image", cls: "muted" },
        { text: "  ↳ signing deploy tx on " + CONFIG.chain, cls: "muted" },
        { text: "  ↳ seeding liquidity " + (0.2 + Math.random() * 1.4).toFixed(2) + " " + CONFIG.currency, cls: "muted" },
      ], 420);
      termPrint("✓ deployed $" + escapeHtml(ticker) + " · tx " + shortAddr() + " confirmed", "ok");
      termPrint("  trade it on " + CONFIG.platform + " ↗", "acc");
    },
    ca() {
      termPrint(CONFIG.ca, "acc");
      termPrint("(" + CONFIG.chain + ") — verify before trading.", "muted");
    },
    links() {
      termPrint("platform   " + CONFIG.platform + "  →  https://" + CONFIG.platform, "acc");
      termPrint("twitter    " + CONFIG.twitter, "acc");
      termPrint("telegram   " + CONFIG.telegram, "acc");
    },
    banner() {
      termPrint(
        " ██████╗██╗      █████╗ ██╗    ██╗ ██████╗ ██████╗ ██╗   ██╗███████╗\n" +
        "██╔════╝██║     ██╔══██╗██║    ██║██╔═══██╗██╔══██╗██║   ██║██╔════╝\n" +
        "██║     ██║     ███████║██║ █╗ ██║██║   ██║██████╔╝██║   ██║███████╗\n" +
        "██║     ██║     ██╔══██║██║███╗██║██║   ██║██╔═══╝ ██║   ██║╚════██║\n" +
        "╚██████╗███████╗██║  ██║╚███╔███╔╝╚██████╔╝██║     ╚██████╔╝███████║\n" +
        " ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝  ╚═════╝ ╚═╝      ╚═════╝ ╚══════╝",
        "acc"
      );
    },
    whoami() { termPrint("guest — visiting clawopus the dev", "muted"); },
    date() { termPrint(new Date().toString()); },
    ls() { termPrint("oracle/   launches/   timeline/   web/   README.md", "muted"); },
    echo(args) { termPrint(escapeHtml(args.join(" "))); },
    clear() { const o = document.getElementById("term-out"); if (o) o.innerHTML = ""; },
  };

  async function runCommand(raw) {
    const line = raw.trim();
    termPrint('<span class="prompt">guest@clawopus</span><span class="path">:~/the-dev$</span> <span class="cmd-echo">' + escapeHtml(line) + "</span>");
    if (!line) return;
    HISTORY.push(line);
    histIdx = HISTORY.length;
    const [cmd, ...args] = line.split(/\s+/);
    const fn = HANDLERS[cmd.toLowerCase()];
    if (!fn) {
      termPrint("command not found: " + escapeHtml(cmd) + " — type 'help'", "err");
      return;
    }
    termBusy = true;
    try { await fn(args); } finally { termBusy = false; }
  }

  function initTerminal() {
    const term = document.getElementById("term");
    const input = document.getElementById("term-input");
    if (!term || !input) return;

    termPrint("CLAWOPUS console ready. type <span class='acc'>help</span> to begin.", "muted");

    term.addEventListener("click", () => input.focus());
    setTimeout(() => input.focus(), 50);

    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        if (termBusy) return;
        const val = input.value;
        input.value = "";
        await runCommand(val);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (HISTORY.length) {
          histIdx = Math.max(0, histIdx - 1);
          input.value = HISTORY[histIdx] || "";
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (HISTORY.length) {
          histIdx = Math.min(HISTORY.length, histIdx + 1);
          input.value = HISTORY[histIdx] || "";
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const part = input.value.trim().toLowerCase();
        if (part) {
          const match = COMMANDS.find((c) => c.startsWith(part));
          if (match) input.value = match + " ";
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        HANDLERS.clear();
      }
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    wireLinks();
    wireCopy();
    await runBoot();
    const state = await fillStats();
    initTerminal();
    runFeed(state);
  });
})();
