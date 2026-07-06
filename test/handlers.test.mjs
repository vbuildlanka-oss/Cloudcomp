// Unit tests for the Nimbus serverless handlers.
// Invokes each handler with a mock (req, res) — the same shape Vercel provides —
// and asserts on the status code, headers, and JSON body.
//
//   node test/handlers.test.mjs      (or: npm test)

import assert from 'node:assert/strict';

import health from '../api/health.js';
import ping from '../api/ping.js';
import region from '../api/region.js';
import echo from '../api/echo.js';
import ratelimit from '../api/ratelimit.js';

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = String(v);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    end(data) {
      if (data !== undefined) this.body = data;
      return this;
    },
  };
}

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    query: {},
    ...overrides,
  };
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

console.log('\nRunning Nimbus handler tests...\n');

check('health returns operational telemetry + cold start flips warm', () => {
  const r1 = mockRes();
  health(mockReq(), r1);
  assert.equal(r1.statusCode, 200);
  assert.equal(r1.body.status, 'operational');
  assert.equal(r1.body.coldStart, true, 'first call should be a cold start');
  assert.match(r1.body.runtime, /^Node v/);
  assert.equal(r1.headers['cache-control'], 'no-store');

  const r2 = mockRes();
  health(mockReq(), r2);
  assert.equal(r2.body.coldStart, false, 'second call should be warm');
});

check('ping returns pong + timestamp', () => {
  const r = mockRes();
  ping(mockReq(), r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.pong, true);
  assert.ok(typeof r.body.ts === 'number');
});

check('region reports edge=false locally, with null geo', () => {
  const r = mockRes();
  region(mockReq(), r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.onEdge, false);
  assert.equal(r.body.region, 'local-dev');
});

check('region reads Vercel geo headers when present', () => {
  const r = mockRes();
  region(mockReq({ headers: { 'x-vercel-ip-country': 'LK', 'x-vercel-ip-city': 'Colombo' } }), r);
  assert.equal(r.body.country, 'LK');
  assert.equal(r.body.city, 'Colombo');
});

check('echo reflects method + masks the client IP', () => {
  const r = mockRes();
  echo(mockReq({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.42', 'user-agent': 'jest' } }), r);
  assert.equal(r.body.method, 'POST');
  assert.equal(r.body.ip, '203.•••.•••.42', 'IP should be masked');
  assert.equal(r.body.userAgent, 'jest');
});

check('ratelimit allows a burst then returns 429', () => {
  const req = mockReq({ headers: { 'x-forwarded-for': '198.51.100.7' } });
  let allowed = 0;
  let blocked = 0;
  for (let i = 0; i < 10; i += 1) {
    const r = mockRes();
    ratelimit(req, r);
    if (r.statusCode === 200) {
      allowed += 1;
      assert.equal(r.body.allowed, true);
    } else {
      blocked += 1;
      assert.equal(r.statusCode, 429);
      assert.equal(r.headers['retry-after'], '1');
    }
  }
  assert.equal(allowed, 6, 'capacity is 6 tokens');
  assert.equal(blocked, 4, 'remaining requests should be throttled');
});

console.log(`\nAll ${passed} handler tests passed. ✅\n`);
