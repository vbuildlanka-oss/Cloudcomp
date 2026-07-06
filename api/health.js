// Nimbus — serverless health & runtime telemetry
//
// A Vercel Node serverless function. Module-scoped state (COLD, BOOTED) persists
// for the lifetime of a *warm* instance, which lets us report cold vs. warm
// starts — a real signal about serverless behaviour.

let COLD = true;
const BOOTED = Date.now();

export default function handler(req, res) {
  const coldStart = COLD;
  COLD = false;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'operational',
    service: 'nimbus-edge',
    version: '1.0.0',
    coldStart,
    region: process.env.VERCEL_REGION || 'local-dev',
    runtime: `Node ${process.version}`,
    instanceUptimeSec: Math.max(0, Math.round((Date.now() - BOOTED) / 1000)),
    serverTime: new Date().toISOString(),
  });
}
