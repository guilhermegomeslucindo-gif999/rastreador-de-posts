// api/ai.js  –  Gerador de legenda com Google Gemini
// A chave fica APENAS na variável de ambiente GEMINI_API_KEY no Vercel.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(501).json({ error: 'GEMINI_API_KEY não configurada. Vá em Vercel > Settings > Environment Variables e adicione GEMINI_API_KEY.' });

  let body = '';
  try {
    body = await new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', d => raw += d);
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    });
  } catch (e) {
    return res.status(400).json({ error: 'Erro ao ler requisição' });
  }

  let data;
  try { data = JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON inválido' }); }

  const { clientName, clientNiche, fixedNote, img, imgKey, referencesCaptions, voiceProfile, chipAdjust } = data;

  // Monta contexto
  const contextParts = [];
  contextParts.push(`Cliente: ${clientName || 'marmoraria'}`);
  if (clientNiche) contextParts.push(`Nicho: ${clientNiche}`);
  if (fixedNote) contextParts.push(`Lembrete fixo do cliente: ${fixedNote}`);
  if (voiceProfile) contextParts.push(`Perfil de voz do cliente (use como referência de tom e estilo):\n${voiceProfile}`);
  if (chipAdjust) contextParts.push(`Ajuste solicitado: ${chipAdjust}`);

  let refBlock = '';
  if (referencesCaptions && referencesCaptions.length > 0) {
    refBlock = '\n\nLegendas já publicadas deste cliente (use como referência de tom, estrutura, tamanho, emojis, CTA e hashtags):\n';
    referencesCaptions.slice(0, 8).forEach((cap, i) => {
      if (cap && cap.trim()) refBlock += `\n--- Exemplo ${i+1} ---\n${cap.trim()}\n`;
    });
  }

  const prompt = `Você é um especialista em marketing para Instagram de marmorarias e decoração. Gere legendas em português do Brasil, envolventes, elegantes e com apelo emocional. Nunca use travessão (—).

${contextParts.join('\n')}${refBlock}

Analise a imagem do post (se houver) e gere EXATAMENTE 3 variações de legenda para Instagram:
- Variação 1: Curta e impactante (até 100 caracteres + hashtags)
- Variação 2: Média com storytelling (150-300 caracteres + hashtags)
- Variação 3: Com CTA forte de WhatsApp/direct (200-400 caracteres + hashtags)

Cada legenda deve:
- Ser baseada no que aparece visualmente na imagem
- Ter emojis adequados ao tom do cliente
- Terminar com 5 a 8 hashtags relevantes para marmoraria/decoração
- NÃO usar travessão (—)

Responda APENAS em JSON neste formato exato:
{
  "variations": [
    { "label": "Curta", "text": "..." },
    { "label": "Media", "text": "..." },
    { "label": "CTA Forte", "text": "..." }
  ],
  "voiceProfileUpdate": "Resumo do estilo do cliente em 2-3 frases."
}`;

  // Monta parts para o Gemini
  const parts = [{ text: prompt }];

  // Adiciona imagem se tiver
  let imgData = null;
  if (img && img.startsWith('data:image')) {
    imgData = img;
  } else if (imgKey) {
    try {
      const base = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000';
      const imgRes = await fetch(`${base}/api/img?k=${imgKey}`, { headers: { 'x-internal': '1' } });
      if (imgRes.ok) {
        const imgJson = await imgRes.json();
        if (imgJson.url && imgJson.url.startsWith('data:')) imgData = imgJson.url;
      }
    } catch (_) {}
  }

  if (imgData) {
    const [meta, b64] = imgData.split(',');
    const mimeType = (meta.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
    parts.push({ inline_data: { mime_type: mimeType, data: b64 } });
  }

  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const gemRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 1200,
          temperature: 0.8
        }
      })
    });

    if (!gemRes.ok) {
      const errJson = await gemRes.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Erro Gemini: ${gemRes.status}`;
      if (gemRes.status === 429) return res.status(429).json({ error: 'Limite de requisições Gemini atingido. Aguarde um momento e tente novamente.' });
      if (gemRes.status === 400 && msg.includes('API_KEY')) return res.status(401).json({ error: 'Chave Gemini inválida. Verifique a variável GEMINI_API_KEY na Vercel.' });
      return res.status(500).json({ error: msg });
    }

    const gemJson = await gemRes.json();
    const rawText = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try { parsed = JSON.parse(rawText); } catch { return res.status(500).json({ error: 'IA retornou formato inválido. Tente novamente.' }); }

    return res.status(200).json({
      variations: parsed.variations || [],
      voiceProfileUpdate: parsed.voiceProfileUpdate || null
    });

  } catch (e) {
    return res.status(500).json({ error: 'Erro ao conectar com a IA: ' + (e?.message || String(e)) });
  }
}
