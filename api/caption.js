import { readBody } from './_redis.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

// Lê a IMAGEM do post e escreve a legenda. Requer ANTHROPIC_API_KEY nas variáveis da Vercel.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'no_key' });

  const { img, notes } = readBody(req);
  const m = img ? /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(img) : null;
  if (!m) return res.status(400).json({ error: 'imagem inválida ou ausente' });

  const prompt =
    'Você é social media de uma agência que atende marmorarias. Escreva a legenda de Instagram para ESTE post.\n\n' +
    'Antes de escrever, leia a imagem com atenção:\n' +
    '- todo texto escrito na arte (título, chamadas, ofertas, telefone, cidade, datas);\n' +
    '- o nome ou logo da empresa que aparece na arte;\n' +
    '- o que é mostrado: tipo de pedra ou material, cor, veios, acabamento, peça ou ambiente.\n\n' +
    'Regras:\n' +
    '- A legenda deve falar exatamente do que está no post. Nada genérico.\n' +
    '- Use o nome da empresa que aparece na arte. Se nenhum nome estiver visível, não cite nome de empresa.\n' +
    '- Não invente nome comercial de pedra, preço, telefone ou promoção que não esteja na imagem.\n' +
    '- Português do Brasil, tom sofisticado e próximo.\n' +
    '- Estrutura: 1 frase de abertura com 1 emoji; 1 parágrafo curto (2 a 3 frases); 1 chamada para ação (direct ou WhatsApp); 1 linha com 5 a 7 hashtags ligadas ao que aparece.\n' +
    (notes && String(notes).trim() ? '- Observações do time para seguir: ' + String(notes).trim().slice(0, 600) + '\n' : '') +
    '\nResponda somente com a legenda, sem aspas e sem comentários.';

  const models = [process.env.ANTHROPIC_MODEL, 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-5'].filter(Boolean);
  try {
    let lastErr = 'sem resposta';
    for (const model of models) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
            { type: 'text', text: prompt }
          ] }]
        })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = (j.content || []).map(x => x.text || '').join('').trim();
        if (text) return res.status(200).json({ text, usedImage: true, model });
        lastErr = 'resposta vazia';
        continue;
      }
      lastErr = (j.error && j.error.message) || ('Anthropic respondeu ' + r.status);
      // só tenta o próximo modelo se o erro for de modelo não encontrado
      if (!(r.status === 404 || /model/i.test(lastErr))) break;
    }
    if (/credit|balance/i.test(lastErr)) lastErr = 'a conta da Anthropic está sem créditos';
    if (/api[_ -]?key|authentication|x-api-key/i.test(lastErr)) lastErr = 'a chave ANTHROPIC_API_KEY é inválida';
    return res.status(502).json({ error: lastErr });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
