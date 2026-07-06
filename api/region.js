// Nimbus — edge location & geo awareness.
//
// On Vercel's network the request carries geo headers injected at the edge
// (x-vercel-ip-*), and the executing datacentre is in VERCEL_REGION. We surface
// those to show the app is aware of *where* in the world it is running/serving.

export default function handler(req, res) {
  const h = req.headers || {};
  const decode = (v) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    region: process.env.VERCEL_REGION || 'local-dev',
    onEdge: Boolean(process.env.VERCEL_REGION),
    country: h['x-vercel-ip-country'] || null,
    city: decode(h['x-vercel-ip-city']),
    latitude: h['x-vercel-ip-latitude'] || null,
    longitude: h['x-vercel-ip-longitude'] || null,
  });
}
