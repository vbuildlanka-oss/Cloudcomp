// Beacon — website health, SEO & security auditor.
// A small stateless Express server: serves the static UI and exposes /api/audit.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit } from "./src/audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));

// Liveness/readiness probe (used by Render's health check).
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "beacon", time: new Date().toISOString() });
});

// The core endpoint: audit any public website.
app.get("/api/audit", async (req, res) => {
  try {
    const report = await runAudit(req.query.url);
    res.json(report);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || "Audit failed unexpectedly." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🔦  Beacon listening on http://0.0.0.0:${PORT}\n`);
});

export default app;
