// Ad-hoc check that the Vercel serverless handlers behave like the Express API.
// Not part of `npm test`; run manually with: node test/serverless.check.mjs
import auditHandler from "../api/audit.js";
import healthHandler from "../api/health.js";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

async function run() {
  // health
  const h = mockRes();
  healthHandler({ method: "GET" }, h);
  console.assert(h.statusCode === 200 && h.body.status === "ok", "health failed");

  // good audit
  const a = mockRes();
  await auditHandler({ method: "GET", query: { url: "example.com" } }, a);
  console.assert(a.statusCode === 200 && typeof a.body.score === "number", "audit failed");
  console.assert(String(a.headers["cache-control"] || "").includes("s-maxage"), "cache header missing");

  // bad url -> 400 (real error, surfaced immediately)
  const b = mockRes();
  await auditHandler({ method: "GET", query: { url: "not a url" } }, b);
  console.assert(b.statusCode === 400 && b.body.error, "bad-url handling failed");

  // wrong method -> 405
  const m = mockRes();
  await auditHandler({ method: "POST", query: {} }, m);
  console.assert(m.statusCode === 405, "method guard failed");

  console.log("serverless handlers OK:", {
    health: h.statusCode,
    auditScore: a.body.score,
    auditGrade: a.body.grade,
    badUrl: b.statusCode,
    badUrlMsg: b.body.error,
    method: m.statusCode,
  });
}

run().catch((e) => { console.error(e); process.exit(1); });
