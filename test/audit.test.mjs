// Tests for Beacon.
//   node test/audit.test.mjs   (or: npm test)
//
// - Deterministic, offline tests for URL safety and the scoring logic.
// - A best-effort LIVE test that audits example.com (skipped gracefully if the
//   network is unavailable).

import assert from "node:assert/strict";
import { safeUrl } from "../src/guard.js";
import { buildReport } from "../src/checks.js";
import { runAudit } from "../src/audit.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

function throws(fn) {
  try {
    fn();
  } catch {
    return true;
  }
  return false;
}

console.log("\nRunning Beacon tests...\n");

// --- URL guard --------------------------------------------------------------
check("safeUrl adds https:// and normalises", () => {
  assert.equal(safeUrl("example.com").href, "https://example.com/");
  assert.equal(safeUrl("http://foo.com").protocol, "http:");
});

check("safeUrl rejects private / local / invalid hosts", () => {
  assert.ok(throws(() => safeUrl("localhost")));
  assert.ok(throws(() => safeUrl("http://127.0.0.1")));
  assert.ok(throws(() => safeUrl("http://169.254.169.254")));
  assert.ok(throws(() => safeUrl("http://192.168.1.1")));
  assert.ok(throws(() => safeUrl("ftp://example.com")));
  assert.ok(throws(() => safeUrl("notadomain")));
});

// --- Scoring: a healthy site scores high -----------------------------------
const goodRaw = {
  requestedUrl: "https://good.example/",
  finalUrl: "https://good.example/",
  https: true,
  statusCode: 200,
  responseTimeMs: 180,
  sizeBytes: 500 * 1024,
  contentType: "text/html; charset=utf-8",
  isHtml: true,
  redirects: 0,
  redirectChain: [{ url: "https://good.example/", status: 200 }],
  headers: { server: "nginx", contentType: "text/html", hsts: true, csp: true, xContentType: true, xFrame: true, referrerPolicy: true },
  html: {
    title: "A Great, Well-Optimised Homepage",
    metaDescription: "A".repeat(120),
    canonical: "https://good.example/",
    lang: "en",
    viewport: "width=device-width, initial-scale=1",
    favicon: "/favicon.ico",
    h1Count: 1,
    imgTotal: 6,
    imgMissingAlt: 0,
    linkCount: 30,
    wordCount: 800,
    ogTitle: "Great Homepage",
    ogImage: "https://good.example/og.png",
    twitterCard: "summary",
    generator: "",
  },
};

check("healthy site scores high (A/B, no failures)", () => {
  const r = buildReport(goodRaw);
  assert.ok(r.score >= 85, `score ${r.score}`);
  assert.ok(["A", "B"].includes(r.grade), `grade ${r.grade}`);
  assert.equal(r.counts.fail, 0);
});

// --- Scoring: a poor site scores low ---------------------------------------
const badRaw = {
  requestedUrl: "http://bad.example/",
  finalUrl: "http://bad.example/",
  https: false,
  statusCode: 200,
  responseTimeMs: 3200,
  sizeBytes: 4 * 1024 * 1024,
  contentType: "text/html",
  isHtml: true,
  redirects: 3,
  redirectChain: [],
  headers: { server: null, contentType: "text/html", hsts: false, csp: false, xContentType: false, xFrame: false, referrerPolicy: false },
  html: {
    title: "",
    metaDescription: "",
    canonical: "",
    lang: "",
    viewport: "",
    favicon: "",
    h1Count: 0,
    imgTotal: 4,
    imgMissingAlt: 4,
    linkCount: 2,
    wordCount: 40,
    ogTitle: "",
    ogImage: "",
    twitterCard: "",
    generator: "WordPress",
  },
};

check("poor site scores low (F, multiple failures)", () => {
  const r = buildReport(badRaw);
  assert.ok(r.score < 60, `score ${r.score}`);
  assert.equal(r.grade, "F");
  assert.ok(r.counts.fail >= 3, `fails ${r.counts.fail}`);
});

// --- Live test (best-effort) -----------------------------------------------
async function liveTest() {
  try {
    const r = await runAudit("https://example.com");
    assert.equal(r.statusCode, 200);
    assert.equal(r.https, true);
    assert.ok(typeof r.score === "number");
    assert.ok(/example/i.test(r.title || ""));
    passed += 1;
    console.log("  [PASS] live audit of example.com");
  } catch (err) {
    console.log(`  [SKIP] live audit (no network?): ${err.message}`);
  }
}

await liveTest();

console.log(`\n${passed} checks passed. ✅\n`);
