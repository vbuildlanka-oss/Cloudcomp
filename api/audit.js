// Vercel serverless function: GET /api/audit?url=<website>
//
// This reuses the exact same audit engine as the Express server (src/audit.js),
// so behaviour is identical whether Beacon runs locally, on Render, or on Vercel.
//
// Why Vercel? Its serverless functions cold-start in well under a second and do
// NOT spin down for 30-60s like a free always-on web service. That removes the
// "server is taking a while to wake up" problem at the root.

import { runAudit } from "../src/audit.js";

export default async function handler(req, res) {
  // The auditor is a read-only GET endpoint.
  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed. Use GET." });
    return;
  }

  // Vercel parses the query string for us; a param can be string | string[].
  const q = req.query || {};
  const url = Array.isArray(q.url) ? q.url[0] : q.url;

  try {
    const report = await runAudit(url);
    // Small edge cache: identical audits within a minute are served instantly,
    // which also softens any burst of retries from a client.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json(report);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || "Audit failed unexpectedly." });
  }
}
