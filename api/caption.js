import { readBody } from './_redis.js';

// Opcional: com ANTHROPIC_API_KEY configurada, a legenda é escrita pela IA de verdade.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'no_key' });
  const { client } = readBody(req);
  const prompt = 'Escreva uma legenda de Instagram em português do Brasil para um post da ' + (client || 'marmoraria') +
    ', uma marmoraria (pedras naturais, mármore, granito, quartzito). Tom sofisticado e próximo. Estrutura: uma frase de abertura com 1 emoji, ' +
    'um parágrafo curto valorizando o material e o acabamento, uma chamada para orçamento pelo direct ou WhatsApp, e 5 hashtags. Responda somente com a legenda.';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    });
    const j = await r.json();
    const text = (j.content || []).map(c => c.text || '').join('').trim();
    if (!text) return res.status(502).json({ error: 'empty' });
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
