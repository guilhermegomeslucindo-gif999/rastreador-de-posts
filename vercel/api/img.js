import { pipeline, configured, readBody } from './_redis.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const clean = k => String(k || '').replace(/[^\w-]/g, '_').slice(0, 160);

export default async function handler(req, res) {
  if (!configured()) return res.status(503).json({ error: 'db_not_configured' });
  try {
    if (req.method === 'GET') {
      const k = clean(req.query && req.query.k);
      const [v] = await pipeline([['GET', 'qh4:img:' + k]]);
      if (!v) return res.status(404).end();
      const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(v);
      if (!m) return res.status(500).end();
      res.setHeader('Content-Type', m[1]);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(m[2], 'base64'));
    }
    if (req.method === 'POST') {
      const b = readBody(req);
      const k = clean(b.k);
      if (!k || !/^data:image\//.test(b.v || '')) return res.status(400).json({ error: 'invalid' });
      if (b.v.length > 3800000) return res.status(413).json({ error: 'too_large' });
      await pipeline([['SET', 'qh4:img:' + k, b.v]]);
      return res.status(200).json({ url: '/api/img?k=' + encodeURIComponent(k) });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
