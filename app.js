/* Nimbus — client logic.
 *
 * Talks to same-origin serverless functions (/api/*). If they're unreachable
 * (e.g. opened as a static file, or a host without the functions), every panel
 * transparently falls back to clearly-labelled simulated data, so the console
 * always works and always looks alive.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { mode: "connecting", latencies: [], rlRemaining: 6 };
  const RL_CAP = 6;

  // --- fetch helper with timeout + timing -------------------------------
  async function fetchJSON(path, { timeout = 4000, ...opts } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const t0 = performance.now();
    try {
      const res = await fetch(path, { cache: "no-store", signal: ctrl.signal, ...opts });
      const ms = performance.now() - t0;
      const data = res.ok ? await res.json().catch(() => null) : null;
      return { ok: res.ok, status: res.status, ms, data };
    } catch (err) {
      return { ok: false, status: 0, ms: performance.now() - t0, data: null, err };
    } finally {
      clearTimeout(timer);
    }
  }

  const isLive = () => state.mode === "live";
  const fmtUptime = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

  function setMode(mode) {
    state.mode = mode;
    const pill = $("mode-pill");
    pill.dataset.mode = mode;
    $("mode-label").textContent =
      mode === "live" ? "Live · serverless" : mode === "demo" ? "Demo mode" : "Connecting…";
    $("demo-banner").hidden = mode !== "demo";
  }

  // --- simulators (demo mode) -------------------------------------------
  const simHealth = () => ({
    status: "operational",
    region: "demo-local",
    runtime: "Browser demo",
    coldStart: false,
    instanceUptimeSec: Math.floor(performance.now() / 1000),
    serverTime: new Date().toISOString(),
  });
  const simRegion = () => ({ region: "demo-local", onEdge: false, country: null, city: null, latitude: null, longitude: null });
  const simEcho = () => ({
    method: "GET",
    ip: "masked (demo)",
    userAgent: navigator.userAgent.slice(0, 42) + "…",
    host: location.host || "localhost",
    protocol: location.protocol.replace(":", "") || "http",
    headerCount: 12,
  });

  // --- panel renderers ---------------------------------------------------
  function applyHealth(d) {
    $("health-badge").textContent = d.status;
    $("health-badge").className = "badge ok";
    $("h-region").textContent = d.region;
    $("h-runtime").textContent = d.runtime;
    $("h-cold").textContent = d.coldStart ? "❄️ Cold start" : "🔥 Warm";
    $("h-uptime").textContent = fmtUptime(d.instanceUptimeSec || 0);
    $("h-time").textContent = new Date(d.serverTime).toLocaleTimeString();
  }

  function applyRegion(d) {
    $("region-badge").textContent = d.onEdge ? "edge" : "local";
    $("region-badge").className = "badge" + (d.onEdge ? " ok" : "");
    $("r-region").textContent = d.region || "—";
    $("r-country").textContent = d.country || "N/A";
    $("r-city").textContent = d.city || "N/A";
    $("r-coords").textContent = d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : "N/A";
  }

  function applyEcho(d) {
    $("echo-badge").textContent = d.method;
    $("e-method").textContent = d.method;
    $("e-ip").textContent = d.ip;
    $("e-proto").textContent = d.protocol;
    $("e-host").textContent = d.host;
    $("e-headers").textContent = `${d.headerCount} headers`;
  }

  async function refreshHealth() {
    if (isLive()) {
      const r = await fetchJSON("/api/health");
      applyHealth(r.ok && r.data ? r.data : simHealth());
    } else {
      applyHealth(simHealth());
    }
  }
  async function refreshRegion() {
    if (isLive()) {
      const r = await fetchJSON("/api/region");
      applyRegion(r.ok && r.data ? r.data : simRegion());
    } else {
      applyRegion(simRegion());
    }
  }
  async function refreshEcho() {
    if (isLive()) {
      const r = await fetchJSON("/api/echo");
      applyEcho(r.ok && r.data ? r.data : simEcho());
    } else {
      applyEcho(simEcho());
    }
  }

  // --- latency monitor + sparkline --------------------------------------
  function drawSpark() {
    const c = $("spark");
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || 300;
    const h = c.clientHeight || 120;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const data = state.latencies;
    const pad = 8;
    // baseline grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i += 1) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (data.length < 2) return;

    const max = Math.max(60, ...data);
    const xStep = (w - pad * 2) / (data.length - 1);
    const yOf = (v) => h - pad - (v / max) * (h - pad * 2);
    const pts = data.map((v, i) => [pad + i * xStep, yOf(v)]);

    // area fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(34,211,238,0.35)");
    grad.addColorStop(1, "rgba(34,211,238,0)");
    ctx.beginPath();
    ctx.moveTo(pts[0][0], h - pad);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(34,211,238,0.6)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // head dot
    const [hx, hy] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e8faff";
    ctx.fill();
  }

  async function sampleLatency() {
    let ms;
    if (isLive()) {
      const r = await fetchJSON("/api/ping", { timeout: 3000 });
      ms = r.ok ? r.ms : null;
      if (ms === null) {
        // lost the backend mid-session -> drop to demo gracefully
        setMode("demo");
      }
    }
    if (!isLive()) {
      const spike = Math.random() < 0.12 ? 40 : 0;
      ms = 22 + Math.random() * 16 + spike;
    }
    state.latencies.push(Math.round(ms));
    if (state.latencies.length > 40) state.latencies.shift();

    const arr = state.latencies;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    $("lat-now").textContent = `${arr[arr.length - 1]} ms`;
    $("lat-avg").textContent = `${Math.round(avg)}`;
    $("lat-min").textContent = `${Math.min(...arr)}`;
    $("lat-max").textContent = `${Math.max(...arr)}`;
    $("lat-n").textContent = `${arr.length}`;
    drawSpark();
  }

  // --- rate limiter ------------------------------------------------------
  function renderTokens(remaining) {
    const box = $("rl-tokens");
    box.innerHTML = "";
    for (let i = 0; i < RL_CAP; i += 1) {
      const t = document.createElement("div");
      t.className = "t" + (i < remaining ? " full" : "");
      box.appendChild(t);
    }
    $("rl-remaining").textContent = `${remaining}/${RL_CAP} tokens`;
  }

  // client-side bucket used in demo mode
  const demoBucket = { tokens: RL_CAP, last: Date.now() };
  function demoRateCall() {
    const now = Date.now();
    const refills = Math.floor((now - demoBucket.last) / 1000);
    if (refills > 0) {
      demoBucket.tokens = Math.min(RL_CAP, demoBucket.tokens + refills);
      demoBucket.last = now;
    }
    if (demoBucket.tokens > 0) {
      demoBucket.tokens -= 1;
      return { allowed: true, remaining: demoBucket.tokens };
    }
    return { allowed: false, remaining: 0 };
  }

  async function oneRateCall() {
    if (isLive()) {
      const r = await fetchJSON("/api/ratelimit");
      if (r.status === 429) return { allowed: false, remaining: 0 };
      if (r.ok && r.data) return { allowed: true, remaining: r.data.remaining };
      return { allowed: false, remaining: 0 };
    }
    return demoRateCall();
  }

  async function burst() {
    const btn = $("rl-burst");
    const chips = $("rl-chips");
    btn.disabled = true;
    chips.innerHTML = "";
    for (let i = 0; i < 10; i += 1) {
      const res = await oneRateCall();
      state.rlRemaining = res.remaining;
      const chip = document.createElement("span");
      chip.className = "c " + (res.allowed ? "ok" : "bad");
      chip.textContent = res.allowed ? "200" : "429";
      chips.appendChild(chip);
      renderTokens(res.remaining);
      await new Promise((r) => setTimeout(r, 90));
    }
    btn.disabled = false;
  }

  // --- boot --------------------------------------------------------------
  async function init() {
    renderTokens(RL_CAP);
    $("rl-burst").addEventListener("click", burst);
    window.addEventListener("resize", drawSpark);

    const probe = await fetchJSON("/api/health");
    setMode(probe.ok && probe.data && probe.data.status ? "live" : "demo");
    applyHealth(probe.ok && probe.data ? probe.data : simHealth());

    await Promise.all([refreshRegion(), refreshEcho()]);

    sampleLatency();
    setInterval(sampleLatency, 1600);
    setInterval(refreshHealth, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
