<div align="center">

<img src="assets/logo.svg" alt="Nimbus" width="76" />

# Nimbus

### Live serverless edge console

<em>A real-time dashboard that runs on serverless functions and visualises cloud-native patterns — serverless compute, edge/geo awareness, live latency, and rate limiting — in one glance.</em>

<p>
  <img alt="Serverless" src="https://img.shields.io/badge/architecture-serverless-22d3ee">
  <img alt="Vercel" src="https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel&logoColor=white">
  <img alt="Zero config" src="https://img.shields.io/badge/build-zero--config-8b5cf6">
  <img alt="Tests" src="https://img.shields.io/badge/tests-6%2F6%20passing-34d399">
  <img alt="No keys" src="https://img.shields.io/badge/API%20keys-none-34d399">
</p>

</div>

---

## ☁️ What it is

**Nimbus** is a polished, single-page **operations console** whose panels are powered by
**live serverless functions**. It's built to demonstrate cloud-engineering fundamentals in a
way you can *see and interact with*:

| Panel | Cloud concept it shows |
| --- | --- |
| **Serverless Health** | Live function invocation · cold vs. warm starts · runtime introspection |
| **Edge Latency** | Real-time performance monitoring (round-trip sampling + live sparkline) |
| **Edge Location** | Global edge/CDN + per-request geo awareness |
| **Rate Limiter** | A token-bucket limiter (HTTP 429) — a core API-gateway pattern, from scratch |
| **Request Inspector** | Request handling + privacy-aware IP masking |
| **Architecture** | The stateless, auto-scaling serverless design at a glance |

> **Resilient by design:** if the serverless endpoints are ever unreachable, every panel
> transparently switches to clearly-labelled **demo mode** — so the console never looks broken.

---

## 🧱 Architecture

```
                 ┌─────────────────────────────┐
   Browser  ──▶  │   Global Edge / CDN (static) │  ──▶  index.html · app.js · styles.css
                 └──────────────┬──────────────┘
                                │  /api/*
                                ▼
                 ┌─────────────────────────────┐
                 │   Serverless Functions (λ)   │  health · ping · region · echo · ratelimit
                 │   stateless · auto-scaling   │
                 └─────────────────────────────┘
```

- **Static frontend** served from a global CDN — no framework, **no build step** (nothing to break).
- **Serverless functions** (`/api/*`) — pure Node, **zero dependencies**, stateless, pay-per-use.
- **Config-as-code** in [`vercel.json`](./vercel.json) (security headers, cache policy).
- **CI/CD**: every `git push` triggers an automatic deploy.

### Cloud skills demonstrated
`Serverless` · `Edge / CDN` · `Stateless design` · `Rate limiting (token bucket)` ·
`Observability / latency monitoring` · `Infrastructure-as-config` · `Graceful degradation` · `Security headers`

---

## 🚀 Deploy it free (Vercel)

No credit card, no configuration.

1. Push this repo to **GitHub**.
2. Go to **https://vercel.com** → sign in with GitHub.
3. **Add New… → Project** → import this repository.
4. Leave everything at defaults (framework preset: **Other**) → **Deploy**.
5. In ~1 minute you get a live URL — the `/api/*` functions and the dashboard are all live.

Vercel auto-detects the static files and the `api/` serverless functions. Nothing else to set.

---

## 🖥️ Run locally

The dashboard is plain static files, so the simplest way is:

```bash
npm start          # serves the static site on http://localhost:3000 (demo mode)
```

To run the **serverless functions locally** too (live mode), use the Vercel CLI:

```bash
npm i -g vercel
vercel dev         # serves the site + /api functions on http://localhost:3000
```

### Tests

```bash
npm test           # unit-tests every serverless handler (mock req/res)
```

---

## 📁 Project structure

```
.
├── index.html          # dashboard markup
├── styles.css          # dark glassmorphism theme
├── app.js              # live telemetry, latency chart, rate-limit demo, graceful fallback
├── api/                # serverless functions (Vercel Node, zero deps)
│   ├── health.js       #   runtime telemetry + cold/warm start
│   ├── ping.js         #   minimal endpoint for latency sampling
│   ├── region.js       #   edge region + geo headers
│   ├── echo.js         #   request inspector (IP masked)
│   └── ratelimit.js    #   token-bucket rate limiter (429)
├── test/handlers.test.mjs   # handler unit tests
├── assets/logo.svg
├── vercel.json         # headers + cache config
└── package.json
```

---

<div align="center">
<sub>Nimbus · serverless edge console · no API keys, no database — just cloud-native fundamentals, done cleanly.</sub>
</div>
