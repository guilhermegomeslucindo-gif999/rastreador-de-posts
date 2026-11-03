import { pipeline, configured, readBody } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ error: 'db_not_configured' });
  try {
    if (req.method === 'GET') {
      if (req.query && req.query.only === 'ver') {
        const [v] = await pipeline([['GET', 'qh4:ver']]);
        return res.status(200).json({ ver: Number(v || 0) });
      }
      const [cfg, flat, v] = await pipeline([['GET', 'qh4:cfg'], ['HGETALL', 'qh4:posts'], ['GET', 'qh4:ver']]);
      const posts = {};
      for (let i = 0; i < (flat || []).length; i += 2) posts[flat[i]] = flat[i + 1];
      return res.status(200).json({ cfg: cfg ? JSON.parse(cfg) : null, posts, ver: Number(v || 0) });
    }
    if (req.method === 'POST') {
      const b = readBody(req);
      const cmds = [];
      if (b.replaceAll) cmds.push(['DEL', 'qh4:posts']);
      if (b.cfg) cmds.push(['SET', 'qh4:cfg', JSON.stringify(b.cfg)]);
      if (b.posts) {
        const set = [], del = [];
        for (const k in b.posts) b.posts[k] === null ? del.push(k) : set.push(k, JSON.stringify(b.posts[k]));
        if (set.length) cmds.push(['HSET', 'qh4:posts', ...set]);
        if (del.length) cmds.push(['HDEL', 'qh4:posts', ...del]);
      }
      cmds.push(['INCR', 'qh4:ver']);
      const out = await pipeline(cmds);
      return res.status(200).json({ ver: Number(out[out.length - 1]) });
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
