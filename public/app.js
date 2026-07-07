/* Beacon — frontend logic. Calls the same-origin /api/audit endpoint and
   renders the report: score ring, tallies, key facts, and categorised checks. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("audit-form");
  const input = $("url-input");
  const btn = $("audit-btn");

  const RING_R = 52;
  const CIRC = 2 * Math.PI * RING_R;
  $("ring-fill").style.strokeDasharray = String(CIRC);
  $("ring-fill").style.strokeDashoffset = String(CIRC);

  const CAT_ORDER = ["Performance", "SEO", "Security", "Best Practices"];
  const ICON = { pass: "✓", warn: "!", fail: "✕", info: "i" };

  function show(el) { el.hidden = false; }
  function hide(...els) { els.forEach((e) => (e.hidden = true)); }

  function gradeColor(grade) {
    if (grade === "A" || grade === "B") return "#34d399";
    if (grade === "C") return "#fbbf24";
    return "#f87171";
  }

  function fmtBytes(b) {
    if (!b) return "0 KB";
    if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  // On free hosting the server sleeps when idle; the first request can hit it
  // mid-wake and return a transient error (404/502/503). These are NOT real
  // audit errors (our API uses 400/422 for those), so we transparently retry.
  const TRANSIENT = new Set([404, 408, 425, 429, 500, 502, 503, 504]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Fire-and-forget wake-up so the server is warming before the user clicks. */
  function warmUp() {
    fetch("/api/health", { cache: "no-store" }).catch(() => {});
  }

  async function requestAudit(url, maxAttempts = 5) {
    for (let attempt = 1; ; attempt += 1) {
      let res;
      try {
        res = await fetch(`/api/audit?url=${encodeURIComponent(url)}`, { cache: "no-store" });
      } catch {
        // network-level failure — treat as the server still waking up
        if (attempt >= maxAttempts) throw new Error("Couldn't reach the server. Please try again in a moment.");
        await coldStartWait(attempt);
        continue;
      }

      if (res.ok) return res.json();

      const data = await res.json().catch(() => ({}));
      // A real client/audit error (bad URL, unreachable site) — show it now.
      if (!TRANSIENT.has(res.status)) {
        throw new Error(data.error || `Request failed (HTTP ${res.status}).`);
      }
      // Transient (cold start) — retry until the instance is awake.
      if (attempt >= maxAttempts) {
        throw new Error("The server is taking a while to wake up. Please try once more.");
      }
      await coldStartWait(attempt);
    }
  }

  function coldStartWait(attempt) {
    $("loading-note").textContent = "Waking up the free server… hang tight ⏳";
    return sleep(Math.min(700 * attempt, 2500));
  }

  async function audit(url) {
    if (!url) return;
    hide($("report"), $("error"));
    $("loading-url").textContent = url;
    $("loading-note").textContent = "";
    show($("loading"));
    btn.disabled = true;

    try {
      const data = await requestAudit(url);
      render(data);
    } catch (err) {
      $("error-msg").textContent = err.message || "Something went wrong. Please try again.";
      hide($("loading"));
      show($("error"));
    } finally {
      btn.disabled = false;
    }
  }

  function render(r) {
    hide($("loading"), $("error"));

    // Score ring
    const color = gradeColor(r.grade);
    $("ring-score").textContent = r.score;
    const fill = $("ring-fill");
    fill.style.stroke = color;
    fill.style.strokeDashoffset = String(CIRC * (1 - r.score / 100));
    const grade = $("grade");
    grade.textContent = `Grade ${r.grade}`;
    grade.style.color = color;
    grade.style.background = `${color}22`;

    // Audited URL + status dot
    const link = $("final-url");
    link.textContent = r.finalUrl;
    link.href = r.finalUrl;
    $("status-dot").style.background = r.statusCode < 400 ? "var(--pass)" : "var(--fail)";

    // Tallies
    $("t-pass").textContent = r.counts.pass;
    $("t-warn").textContent = r.counts.warn;
    $("t-fail").textContent = r.counts.fail;

    // Facts
    const facts = [
      ["Status", `HTTP ${r.statusCode}`],
      ["Load time", `${r.responseTimeMs} ms`],
      ["Page size", fmtBytes(r.sizeBytes)],
      ["Redirects", String(r.redirects)],
      ["HTTPS", r.https ? "Yes" : "No"],
      ["Server", r.server || "—"],
    ];
    $("facts").innerHTML = facts
      .map(([k, v]) => `<div class="fact"><span>${k}</span><b>${escapeHtml(v)}</b></div>`)
      .join("");

    // Categories
    const byCat = {};
    for (const c of r.checks) (byCat[c.category] ||= []).push(c);
    const cats = CAT_ORDER.filter((c) => byCat[c]).concat(
      Object.keys(byCat).filter((c) => !CAT_ORDER.includes(c))
    );
    $("categories").innerHTML = cats
      .map((cat) => {
        const items = byCat[cat];
        const passed = items.filter((i) => i.status === "pass").length;
        const rows = items
          .map(
            (i) => `
          <div class="item ${i.status}">
            <div class="ic">${ICON[i.status] || "•"}</div>
            <div class="body">
              <div class="label">${escapeHtml(i.label)}</div>
              <div class="detail">${escapeHtml(i.detail)}</div>
            </div>
          </div>`
          )
          .join("");
        return `<div class="cat"><h3>${escapeHtml(cat)}<span class="cat-count">${passed}/${items.length}</span></h3>${rows}</div>`;
      })
      .join("");

    show($("report"));
    $("report").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Events
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    audit(input.value.trim());
  });
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.url;
      audit(chip.dataset.url);
    });
  });

  // Warm the server as early as possible so the first real click is instant.
  warmUp();
  input.addEventListener("focus", warmUp, { once: true });
})();
