// Turn a raw audit observation into a categorised checklist + weighted score.
// This module is pure (no I/O), so it's easy to unit-test deterministically.

const KB = 1024;
const MB = 1024 * KB;

function check(category, label, status, detail, weight = 1) {
  return { category, label, status, detail, weight };
}

/** Build every check from the raw observation. */
export function buildChecks(raw) {
  const checks = [];
  const h = raw.html || {};
  const hdr = raw.headers || {};

  // --- Performance -------------------------------------------------------
  checks.push(
    raw.statusCode >= 200 && raw.statusCode < 400
      ? check("Performance", "Responds successfully", "pass", `HTTP ${raw.statusCode}`, 3)
      : check("Performance", "Responds successfully", "fail", `HTTP ${raw.statusCode}`, 3)
  );

  const rt = raw.responseTimeMs;
  checks.push(
    check(
      "Performance",
      "Fast response time",
      rt < 600 ? "pass" : rt < 1500 ? "warn" : "fail",
      `${rt} ms to first response`,
      2
    )
  );

  const size = raw.sizeBytes || 0;
  checks.push(
    check(
      "Performance",
      "Reasonable page weight",
      size < 1 * MB ? "pass" : size < 3 * MB ? "warn" : "fail",
      `${(size / KB).toFixed(0)} KB downloaded`,
      1
    )
  );

  checks.push(
    check(
      "Performance",
      "Minimal redirects",
      raw.redirects === 0 ? "pass" : raw.redirects <= 2 ? "warn" : "fail",
      raw.redirects === 0 ? "No redirects" : `${raw.redirects} redirect(s)`,
      1
    )
  );

  // --- Security ----------------------------------------------------------
  checks.push(
    raw.https
      ? check("Security", "Served over HTTPS", "pass", "Encrypted connection", 3)
      : check("Security", "Served over HTTPS", "fail", "Site is not using HTTPS", 3)
  );
  checks.push(hdrCheck("Security", "HSTS enabled", hdr.hsts, "Strict-Transport-Security header", 1));
  checks.push(hdrCheck("Security", "Content Security Policy", hdr.csp, "CSP header", 1));
  checks.push(hdrCheck("Security", "No MIME sniffing", hdr.xContentType, "X-Content-Type-Options: nosniff", 1));
  checks.push(
    hdrCheck("Security", "Clickjacking protection", hdr.xFrame || hdr.csp, "X-Frame-Options / frame-ancestors", 1)
  );
  checks.push(hdrCheck("Security", "Referrer policy set", hdr.referrerPolicy, "Referrer-Policy header", 1));

  // --- SEO ---------------------------------------------------------------
  if (!raw.isHtml) {
    checks.push(check("SEO", "HTML document", "info", `Content type: ${raw.contentType || "unknown"}`, 0));
  } else {
    const title = h.title || "";
    checks.push(
      check(
        "SEO",
        "Title tag",
        !title ? "fail" : title.length >= 10 && title.length <= 60 ? "pass" : "warn",
        title ? `${title.length} chars` : "Missing <title>",
        2
      )
    );
    const md = h.metaDescription || "";
    checks.push(
      check(
        "SEO",
        "Meta description",
        !md ? "fail" : md.length >= 50 && md.length <= 160 ? "pass" : "warn",
        md ? `${md.length} chars` : "Missing meta description",
        2
      )
    );
    checks.push(
      check(
        "SEO",
        "Single H1 heading",
        h.h1Count === 1 ? "pass" : "warn",
        `${h.h1Count} <h1> tag(s)`,
        1
      )
    );
    checks.push(hdrCheck("SEO", "Canonical URL", h.canonical, "rel=canonical link", 1));
    checks.push(hdrCheck("SEO", "Language declared", h.lang, "html[lang] attribute", 1));
    const og = h.ogTitle && h.ogImage;
    checks.push(
      check(
        "SEO",
        "Social share tags",
        og ? "pass" : h.ogTitle || h.ogImage ? "warn" : "warn",
        og ? "Open Graph title + image present" : "Incomplete Open Graph tags",
        1
      )
    );
  }

  // --- Best practices ----------------------------------------------------
  if (raw.isHtml) {
    checks.push(
      h.viewport
        ? check("Best Practices", "Mobile viewport", "pass", "Responsive viewport meta present", 2)
        : check("Best Practices", "Mobile viewport", "fail", "No viewport meta tag", 2)
    );
    checks.push(hdrCheck("Best Practices", "Favicon", h.favicon, "Site icon declared", 1));
    if (h.imgTotal > 0) {
      const missRatio = h.imgMissingAlt / h.imgTotal;
      checks.push(
        check(
          "Best Practices",
          "Images have alt text",
          h.imgMissingAlt === 0 ? "pass" : missRatio <= 0.2 ? "warn" : "fail",
          `${h.imgMissingAlt}/${h.imgTotal} images missing alt`,
          1
        )
      );
    }
  }
  checks.push(
    hdr.contentType
      ? check("Best Practices", "Content-Type header", "pass", hdr.contentType, 1)
      : check("Best Practices", "Content-Type header", "warn", "No Content-Type header", 1)
  );

  return checks;
}

function hdrCheck(category, label, present, detail, weight) {
  return check(category, label, present ? "pass" : "warn", present ? detail : `Missing: ${detail}`, weight);
}

/** Weighted score (0-100) + letter grade from a set of checks. */
export function scoreChecks(checks) {
  const scored = checks.filter((c) => c.status !== "info" && c.weight > 0);
  const max = scored.reduce((a, c) => a + c.weight, 0) || 1;
  const earned = scored.reduce((a, c) => a + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0), 0);
  const score = Math.round((earned / max) * 100);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return { score, grade };
}

/** Assemble the final report object returned by the API. */
export function buildReport(raw) {
  const checks = buildChecks(raw);
  const { score, grade } = scoreChecks(checks);

  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) if (c.status in counts) counts[c.status] += 1;

  return {
    requestedUrl: raw.requestedUrl,
    finalUrl: raw.finalUrl,
    https: raw.https,
    statusCode: raw.statusCode,
    responseTimeMs: raw.responseTimeMs,
    sizeBytes: raw.sizeBytes,
    contentType: raw.contentType,
    redirects: raw.redirects,
    redirectChain: raw.redirectChain,
    server: raw.headers?.server || null,
    generator: raw.html?.generator || null,
    title: raw.html?.title || null,
    score,
    grade,
    counts,
    checks,
    auditedAt: new Date().toISOString(),
  };
}
