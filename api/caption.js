import { pipeline, configured, readBody } from './_redis.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

// Gera a legenda olhando a IMAGEM do post. Requer ANTHROPIC_API_KEY nas variáveis da Vercel.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'no_key' });
  const { client, img, imgKey } = readBody(req);

  let dataUrl = img || null;
  if (!dataUrl && imgKey && configured()) {
    const k = String(imgKey).replace(/[^\w-]/g, '_');
    const [v] = await pipeline([['GET', 'qh4:img:' + k]]);
    dataUrl = v || null;
  }
  const m = dataUrl ? /^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/s.exec(dataUrl) : null;

  const nome = client || 'a marmoraria';
  const instrucoes =
    'Você é social media de uma agência que atende marmorarias. ' +
    (m ? 'Analise a imagem: identifique o tipo de pedra ou material (mármore, granito, quartzito, quartzo, porcelanato etc.), cor, veios, acabamento e o ambiente ou peça mostrada (cozinha, bancada, ilha, banheiro, escada, fachada, chapa, obra em andamento). ' +
         'Escreva a legenda falando ESPECIFICAMENTE do que aparece na foto. Não invente o nome comercial da pedra se não tiver certeza: descreva cor e estilo. '
       : '') +
    'Legenda de Instagram em português do Brasil para o perfil de ' + nome + '. Tom sofisticado, próximo e sem exageros. ' +
    'Estrutura: 1 frase de abertura com 1 emoji; 1 parágrafo curto (2 a 3 frases) sobre o que aparece e o benefício para o cliente; ' +
    '1 chamada para orçamento pelo direct ou WhatsApp; uma linha com 5 a 7 hashtags relevantes ao que aparece na imagem. ' +
    'Responda somente com a legenda, sem aspas e sem comentários.';

  const content = m
    ? [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }, { type: 'text', text: instrucoes }]
    : [{ type: 'text', text: instrucoes }];

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 700, messages: [{ role: 'user', content }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || ('anthropic ' + r.status) });
    const text = (j.content || []).map(c => c.text || '').join('').trim();
    if (!text) return res.status(502).json({ error: 'resposta vazia' });
    res.status(200).json({ text, usedImage: !!m });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
