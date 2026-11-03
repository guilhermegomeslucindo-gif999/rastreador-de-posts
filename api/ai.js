// api/ai.js  –  Gerador de legenda com GPT-4o Vision
// Nunca expõe a chave no front-end.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(501).json({ error: 'OPENAI_API_KEY não configurada. Vá em Vercel > Settings > Environment Variables e adicione OPENAI_API_KEY.' });

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

  const { clientName, clientNiche, fixedNote, img, imgKey, referencesCaptions, voiceProfile } = data;

  // Monta conteúdo de texto com contexto
  const contextParts = [];
  contextParts.push(`Cliente: ${clientName || 'marmoraria'}`);
  if (clientNiche) contextParts.push(`Nicho: ${clientNiche}`);
  if (fixedNote) contextParts.push(`Lembrete fixo do cliente: ${fixedNote}`);
  if (voiceProfile) contextParts.push(`Perfil de voz do cliente (use como referência de tom e estilo):\n${voiceProfile}`);

  let refBlock = '';
  if (referencesCaptions && referencesCaptions.length > 0) {
    refBlock = '\n\nLegendas já publicadas deste cliente (use como referência de tom, estrutura, tamanho, emojis, CTA e hashtags):\n';
    referencesCaptions.slice(0, 8).forEach((cap, i) => {
      if (cap && cap.trim()) refBlock += `\n--- Exemplo ${i+1} ---\n${cap.trim()}\n`;
    });
  }

  const systemPrompt = `Você é um especialista em marketing para Instagram de marmorarias e decoração. Gere legendas em português do Brasil, envolventes, elegantes e com apelo emocional. Nunca use travessão (—).`;

  const userText = `${contextParts.join('\n')}${refBlock}

Analise a imagem do post e gere EXATAMENTE 3 variações de legenda para Instagram, cada uma com um estilo diferente:
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
  "voiceProfileUpdate": "Resumo do estilo do cliente em 2-3 frases baseado nas referências e nesta geração."
}`;

  // Monta conteúdo da mensagem (com ou sem imagem)
  const userContent = [];
  userContent.push({ type: 'text', text: userText });

  if (img && img.startsWith('data:image')) {
    userContent.push({ type: 'image_url', image_url: { url: img, detail: 'high' } });
  } else if (imgKey) {
    // imagem salva no Redis via api/img.js - busca a URL via endpoint interno
    try {
      const imgRes = await fetch(`${process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : 'http://localhost:3000'}/api/img?k=${imgKey}`, {
        headers: { 'x-internal': '1' }
      });
      if (imgRes.ok) {
        const imgJson = await imgRes.json();
        if (imgJson.url && imgJson.url.startsWith('data:')) {
          userContent.push({ type: 'image_url', image_url: { url: imgJson.url, detail: 'high' } });
        }
      }
    } catch (_) { /* sem imagem */ }
  }

  try {
    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ]
      })
    });

    if (!oaRes.ok) {
      const errJson = await oaRes.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Erro OpenAI: ${oaRes.status}`;
      if (oaRes.status === 429) return res.status(429).json({ error: 'Limite de requisições OpenAI atingido. Aguarde um momento e tente novamente.' });
      if (oaRes.status === 401) return res.status(401).json({ error: 'Chave OpenAI inválida. Verifique a variável OPENAI_API_KEY na Vercel.' });
      return res.status(500).json({ error: msg });
    }

    const oaJson = await oaRes.json();
    const rawText = oaJson?.choices?.[0]?.message?.content || '{}';
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
