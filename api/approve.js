import { pipeline, configured } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const { m, c, mo, p } = req.query;
  if (!m || !c || !mo || !p) {
    return res.status(400).send(errorPage('Link inválido', 'Parâmetros ausentes.'));
  }

  // ── GET: serve approval page ─────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!configured()) {
      // Fallback page when Redis not configured
      return res.status(200).setHeader('Content-Type', 'text/html').send(
        renderPage(null, null, m, c, mo, p, 'local')
      );
    }
    try {
      const key = `${m}:${c}:${mo}:${p}`;
      const [postRaw, cfgRaw] = await pipeline([
        ['HGET', 'qh4:posts', key],
        ['GET', 'qh4:cfg'],
      ]);
      const post = postRaw ? JSON.parse(postRaw) : null;
      const cfg = cfgRaw ? JSON.parse(cfgRaw) : null;
      const clientName = cfg?.clients?.[c]?.name || c;
      return res.status(200).setHeader('Content-Type', 'text/html').send(
        renderPage(post, clientName, m, c, mo, p, 'remote')
      );
    } catch (e) {
      return res.status(500).send(errorPage('Erro', String(e?.message || e)));
    }
  }

  // ── POST: client approves ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!configured()) return res.status(503).json({ error: 'db_not_configured' });
    try {
      const key = `${m}:${c}:${mo}:${p}`;
      const [postRaw] = await pipeline([['HGET', 'qh4:posts', key]]);
      const post = postRaw ? JSON.parse(postRaw) : {};
      post.status = 'approved';
      post.ready = true;
      post.approvedAt = new Date().toISOString();
      await pipeline([
        ['HSET', 'qh4:posts', key, JSON.stringify(post)],
        ['INCR', 'qh4:ver'],
      ]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}

// ── Month label ───────────────────────────────────────────────────────────────
const MON_LABEL = {
  jan:'Janeiro',feb:'Fevereiro',mar:'Março',apr:'Abril',may:'Maio',jun:'Junho',
  jul:'Julho',aug:'Agosto',sep:'Setembro',oct:'Outubro',nov:'Novembro',dec:'Dezembro',
};
function monthLabel(mo) {
  if (!mo) return mo;
  const [yr, mon] = mo.split('-');
  return (MON_LABEL[mon] || mon) + ' ' + yr;
}

// ── Error page ────────────────────────────────────────────────────────────────
function errorPage(title, msg) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;}
.box{max-width:400px;text-align:center;}</style></head>
<body><div class="box"><h2>${title}</h2><p style="color:#a3a3a3">${msg}</p></div></body></html>`;
}

// ── Full approval page ────────────────────────────────────────────────────────
function renderPage(post, clientName, m, c, mo, p, mode) {
  const imgTag = post?.img
    ? `<img src="${post.img}" alt="Post ${p}" style="width:100%;max-width:400px;border-radius:12px;display:block;margin:0 auto;">`
    : `<div style="width:100%;max-width:400px;margin:0 auto;min-height:200px;background:#1a1a1a;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#737373;font-size:13px;">Sem imagem</div>`;

  const captionBlock = post?.caption
    ? `<div style="background:#1a1a1a;border-radius:10px;padding:16px;font-size:14px;line-height:1.7;color:#f5f5f5;white-space:pre-wrap;text-align:left;">${escHtml(post.caption)}</div>`
    : `<div style="background:#1a1a1a;border-radius:10px;padding:16px;font-size:13px;color:#737373;">Sem legenda</div>`;

  const alreadyApproved = post?.status === 'approved' || post?.status === 'posted';
  const statusBanner = alreadyApproved
    ? `<div style="background:#0d2b1a;border:1px solid #3fd17a44;border-radius:10px;padding:14px;text-align:center;color:#3fd17a;font-weight:600;font-size:13px;">✅ Este post já foi aprovado</div>`
    : '';

  const approveBtn = alreadyApproved ? '' : `
    <button id="approveBtn" onclick="doApprove()" style="width:100%;background:#ff7a1a;color:#0a0a0a;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.3px;">
      ✅ Aprovar post
    </button>`;

  const noPost = !post
    ? `<div style="background:#1a1a1a;border-radius:10px;padding:20px;text-align:center;color:#a3a3a3;">Post não encontrado. Peça o link atualizado para seu atendente.</div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Aprovação de Post — ${escHtml(clientName || c)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#0a0a0a;color:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;padding:24px 16px 40px;}
.card{max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}
.header{text-align:center;padding:8px 0 4px;}
.header h1{font-size:18px;font-weight:700;color:#f5f5f5;}
.header p{font-size:12px;color:#737373;margin-top:4px;}
#toast{display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#3fd17a;color:#06210f;border-radius:8px;padding:12px 24px;font-weight:700;font-size:14px;z-index:999;}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>📋 Aprovação de Post</h1>
    <p>${escHtml(clientName || c)} · ${escHtml(monthLabel(mo))} · Post ${escHtml(p)}</p>
  </div>
  ${noPost}
  ${!post ? '' : imgTag}
  ${!post ? '' : captionBlock}
  ${statusBanner}
  ${approveBtn}
</div>
<div id="toast">✅ Post aprovado com sucesso!</div>
<script>
async function doApprove(){
  const btn=document.getElementById('approveBtn');
  if(btn){btn.disabled=true;btn.textContent='Aprovando…';}
  try{
    const r=await fetch(location.href,{method:'POST'});
    const j=await r.json();
    if(j.ok){
      if(btn){btn.style.background='#3fd17a';btn.textContent='✅ Aprovado!';}
      const t=document.getElementById('toast');t.style.display='block';
      setTimeout(()=>{t.style.display='none';},3500);
    } else {
      alert('Erro ao aprovar: '+(j.error||'tente novamente'));
      if(btn){btn.disabled=false;btn.textContent='✅ Aprovar post';}
    }
  }catch(e){alert('Erro de conexão');if(btn){btn.disabled=false;btn.textContent='✅ Aprovar post';}}
}
</script>
</body>
</html>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
