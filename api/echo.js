// Nimbus — request inspector.
// Reflects details of the incoming request back to the client. The client IP is
// masked (privacy-aware) — we never expose a full address.

function maskIp(ip) {
  if (!ip) return 'unknown';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.•••.•••.${parts[3]}`;
  return ip.length > 10 ? ip.slice(0, 8) + '…' : ip; // IPv6 / other
}

export default function handler(req, res) {
  const h = req.headers || {};
  const ip = (h['x-forwarded-for'] || '').split(',')[0].trim();

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    method: req.method || 'GET',
    ip: maskIp(ip),
    userAgent: h['user-agent'] || 'unknown',
    host: h['host'] || 'unknown',
    protocol: h['x-forwarded-proto'] || 'http',
    headerCount: Object.keys(h).length,
  });
}
