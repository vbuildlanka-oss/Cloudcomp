// Nimbus — ultra-light ping endpoint.
// Deliberately tiny so the client can measure round-trip latency to the edge
// without the payload dominating the timing.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ pong: true, ts: Date.now() });
}
