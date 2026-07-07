<div align="center">

<img src="public/logo.svg" alt="Beacon" width="72" />

# 🔦 Beacon

### Instant website health, SEO &amp; security audit

<em>Point Beacon at any live website and get a real, scored report — performance, SEO, security headers, and best practices — in seconds.</em>

<p>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-server-000000?logo=express&logoColor=white">
  <img alt="Deploy" src="https://img.shields.io/badge/deploy-Render-46E3B7">
  <img alt="No keys" src="https://img.shields.io/badge/API%20keys-none-34d399">
  <img alt="No DB" src="https://img.shields.io/badge/database-none-34d399">
</p>

</div>

---

## ✨ What it does

Type in a URL. Beacon's server fetches that site (following redirects), parses the HTML,
inspects the HTTP response, and returns a graded report:

- **Performance** — response time, page weight, redirect count, status.
- **SEO** — title & meta description quality, single H1, canonical URL, `lang`, Open Graph tags.
- **Security** — HTTPS, HSTS, Content-Security-Policy, `X-Content-Type-Options`, clickjacking protection, referrer policy.
- **Best practices** — mobile viewport, favicon, image `alt` coverage, correct `Content-Type`.

Every check is scored and rolled up into an overall **0–100 score and A–F grade**.

## 🧠 Why it needs a real server (and why that's the point)

A browser **cannot** fetch and inspect other websites — cross-origin (CORS) rules block it.
So Beacon runs a small **Node.js + Express server** that performs the request server-side.
That's a genuine, real-world reason for a backend — exactly the kind of thing a cloud/backend
developer builds.

It's also built defensively: user-supplied URLs are validated and **private/loopback/cloud-metadata
addresses are blocked (SSRF protection)** — including on every redirect hop.

---

## 🏗️ Architecture

```
Browser ──▶  Express server ──▶  target website
             │  • validate + SSRF-guard the URL
             │  • fetch, follow redirects (max 5), 12s timeout
             │  • parse HTML (cheerio) + read security headers
             │  • run weighted checks → score + grade
             ◀── JSON report ──┘
```

- **Stateless** — no database, no sessions; scales trivially.
- **No API keys, no config** — nothing to set up or leak.
- **Clean separation:** `guard` (safety) · `audit` (fetch + parse) · `checks` (pure scoring).

**Cloud/backend skills shown:** REST API design · server-side HTTP & redirects · HTML parsing ·
security-header analysis · **SSRF mitigation** · health checks · infrastructure-as-config · CI/CD deploy.

---

## 🚀 Deploy it free

No credit card, no database.

### Recommended: Vercel (no cold-start sleep) ⚡

Vercel runs the API as **serverless functions** that cold-start in well under a
second and **don't spin down for 30–60s** the way a free always-on web service
does. That's what removes the "server is taking a while to wake up" problem.

1. Push this repo to **GitHub**.
2. Go to **https://vercel.com** → sign in with GitHub.
3. **Add New… → Project** → import this repo. No settings to change — Vercel
   auto-detects the static frontend in [`public/`](./public) and the functions
   in [`api/`](./api), and reads [`vercel.json`](./vercel.json).
4. **Deploy**. In ~1 minute you get a public URL. Done.

> How it maps: `public/*` is served as the static site, `GET /api/audit` →
> [`api/audit.js`](./api/audit.js), `GET /api/health` → [`api/health.js`](./api/health.js).
> All three call the same engine in [`src/`](./src).

### Alternative: Render (Blueprint)

Also works via [`render.yaml`](./render.yaml): on Render pick **New + →
Blueprint** and select this repo. Note the **free** Render web service sleeps
after ~15 min idle, so the first request can take 30–60s to wake — the frontend
now waits patiently (up to 60s) and retries so it still succeeds, but Vercel is
the smoother experience.

---

## 🖥️ Run locally

Requires **Node.js 18+**.

```bash
npm install
npm start          # http://localhost:3000
```

### Test

```bash
npm test           # URL-safety + scoring logic + a live audit of example.com
```

---

## 📡 API

```
GET /api/health              → { status: "ok", ... }
GET /api/audit?url=<website>  → full JSON report (score, grade, checks, facts)
```

Example:

```bash
curl "http://localhost:3000/api/audit?url=example.com"
```

---

## 📁 Project structure

```
.
├── api/                 # Vercel serverless functions (share the src/ engine)
│   ├── audit.js         #   GET /api/audit  — reuses src/audit.js
│   └── health.js        #   GET /api/health
├── server.js            # Express server for local dev / Render (same endpoints)
├── src/
│   ├── guard.js         # URL normalisation + SSRF / private-host protection
│   ├── audit.js         # fetch (redirect chain, timeout) + HTML parsing (cheerio)
│   └── checks.js        # pure, testable scoring → categorised checks + grade
├── public/              # frontend (index.html, styles.css, app.js, logo.svg)
├── test/audit.test.mjs  # safety + scoring + live-fetch tests
├── vercel.json          # Vercel deploy config (function limits + routing)
├── render.yaml          # Render Blueprint (alternative deploy)
└── package.json
```

> The core engine lives in `src/`. Both the Express server (`server.js`) and the
> Vercel functions (`api/`) are thin adapters over it, so behaviour is identical
> everywhere.

---

<div align="center">
<sub>Beacon · a real, useful website auditor · no database, no API keys — just a clean backend, done right.</sub>
</div>
