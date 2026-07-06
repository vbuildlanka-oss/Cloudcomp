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

  async function audit(url) {
    if (!url) return;
    hide($("report"), $("error"));
    $("loading-url").textContent = url;
    show($("loading"));
    btn.disabled = true;

    try {
      const res = await fetch(`/api/audit?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status}).`);
      render(data);
    } catch (err) {
      $("error-msg").textContent =
        err.message === "Failed to fetch"
          ? "Couldn't reach the Beacon server. Is it running?"
          : err.message;
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
})();
