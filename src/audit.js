// The audit engine: fetch a URL (following redirects safely), read the response
// + security headers, parse the HTML, and hand a raw observation to the scorer.

import * as cheerio from "cheerio";
import { safeUrl, httpError } from "./guard.js";
import { buildReport } from "./checks.js";

const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024; // don't parse more than 5 MB of HTML
const UA = "BeaconAudit/1.0 (+https://github.com; website health checker)";

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
  } catch (err) {
    throw httpError(422, err.name === "AbortError" ? "The site took too long to respond (timed out)." : "Could not reach that site.");
  } finally {
    clearTimeout(timer);
  }
}

// Follow redirects manually so we can report the chain — and re-check each hop
// against the SSRF guard (a redirect could point at an internal address).
async function fetchWithChain(startUrl) {
  const chain = [];
  let current = startUrl;
  const started = Date.now();

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const res = await fetchOnce(current);
    chain.push({ url: current, status: res.status });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) return { res, chain, current, responseTimeMs: Date.now() - started };
      const next = new URL(location, current).href;
      safeUrl(next); // guard every hop
      current = next;
      continue;
    }
    return { res, chain, current, responseTimeMs: Date.now() - started };
  }
  throw httpError(422, `Too many redirects (more than ${MAX_REDIRECTS}).`);
}

function readHeaders(res) {
  const g = (k) => res.headers.get(k);
  return {
    server: g("server"),
    contentType: g("content-type"),
    hsts: Boolean(g("strict-transport-security")),
    csp: Boolean(g("content-security-policy")),
    xContentType: (g("x-content-type-options") || "").toLowerCase().includes("nosniff"),
    xFrame: Boolean(g("x-frame-options")),
    referrerPolicy: Boolean(g("referrer-policy")),
  };
}

function parseHtml(body) {
  const $ = cheerio.load(body);
  const attr = (sel, name) => $(sel).first().attr(name) || "";
  const imgs = $("img");
  return {
    title: $("title").first().text().trim(),
    metaDescription: attr('meta[name="description"]', "content").trim(),
    canonical: attr('link[rel="canonical"]', "href"),
    lang: attr("html", "lang"),
    viewport: attr('meta[name="viewport"]', "content"),
    favicon: attr('link[rel~="icon"]', "href"),
    h1Count: $("h1").length,
    imgTotal: imgs.length,
    imgMissingAlt: imgs.filter((_, el) => !$(el).attr("alt")).length,
    linkCount: $("a[href]").length,
    wordCount: $("body").text().replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length,
    ogTitle: attr('meta[property="og:title"]', "content"),
    ogImage: attr('meta[property="og:image"]', "content"),
    twitterCard: attr('meta[name="twitter:card"]', "content"),
    generator: attr('meta[name="generator"]', "content"),
  };
}

/** Audit a website and return a full scored report. */
export async function runAudit(input) {
  const url = safeUrl(input);
  const { res, chain, current, responseTimeMs } = await fetchWithChain(url.href);

  const headers = readHeaders(res);
  const contentType = headers.contentType || "";
  const isHtml = /text\/html/i.test(contentType);

  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "";
  }
  if (body.length > MAX_BYTES) body = body.slice(0, MAX_BYTES);

  const raw = {
    requestedUrl: url.href,
    finalUrl: current,
    https: new URL(current).protocol === "https:",
    statusCode: res.status,
    responseTimeMs,
    sizeBytes: Buffer.byteLength(body),
    contentType,
    isHtml,
    redirects: chain.length - 1,
    redirectChain: chain,
    headers,
    html: isHtml && body ? parseHtml(body) : null,
  };

  return buildReport(raw);
}
