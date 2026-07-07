// Vercel serverless function: GET /api/health
// Liveness probe + the endpoint the frontend pings to warm the function early.

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "ok", service: "beacon", time: new Date().toISOString() });
}
