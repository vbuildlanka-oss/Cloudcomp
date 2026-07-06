// Nimbus — token-bucket rate limiter.
//
// A classic cloud/API-gateway pattern implemented from scratch. Each client
// (keyed by IP) gets a bucket of CAPACITY tokens that refills at REFILL_MS per
// token. Each request spends one token; when the bucket is empty the request is
// rejected with HTTP 429.
//
// NOTE (and a good talking point): serverless instances are ephemeral and not
// shared, so this state is per-warm-instance — in production you'd back it with
// a shared store (e.g. Redis/Upstash). It's perfect for demonstrating the
// algorithm live without any external dependency.

const CAPACITY = 6;
const REFILL_MS = 1000; // one token restored per second
const buckets = new Map();

export default function handler(req, res) {
  const h = req.headers || {};
  const key = (h['x-forwarded-for'] || 'anonymous').split(',')[0].trim() || 'anonymous';
  const now = Date.now();

  const bucket = buckets.get(key) || { tokens: CAPACITY, last: now };
  const refills = Math.floor((now - bucket.last) / REFILL_MS);
  if (refills > 0) {
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + refills);
    bucket.last = now;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-RateLimit-Limit', String(CAPACITY));

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    res.setHeader('X-RateLimit-Remaining', String(bucket.tokens));
    return res.status(200).json({
      allowed: true,
      remaining: bucket.tokens,
      capacity: CAPACITY,
    });
  }

  buckets.set(key, bucket);
  res.setHeader('X-RateLimit-Remaining', '0');
  res.setHeader('Retry-After', '1');
  return res.status(429).json({
    allowed: false,
    remaining: 0,
    capacity: CAPACITY,
    message: 'Rate limit exceeded — slow down.',
  });
}
