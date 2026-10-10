# Rastreador de Posts QH4 — como subir na Vercel

Todo mundo que abrir o link vê a mesma versão. As alterações são salvas num banco online e aparecem para os outros em até 4 segundos.

## 1. Subir o projeto
1. Descompacte este zip.
2. Entre em vercel.com > **Add New… > Project**.
3. Arraste a pasta (ou suba no GitHub e importe). Não precisa mudar nenhuma configuração: deixe Framework = **Other** e clique em **Deploy**.

## 2. Ligar o banco de dados (obrigatório para todos verem a mesma coisa)
1. No projeto na Vercel: aba **Storage > Create Database**.
2. Escolha **Upstash for Redis** (plano grátis) e conecte ao projeto.
   - Isso cria sozinho as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
3. Vá em **Deployments** e clique em **Redeploy** no último deploy.

Pronto. No canto de baixo do menu aparece **● Online · sincronizado**.
Se aparecer **Modo local**, é porque o banco ainda não está ligado.

> O primeiro acesso depois de ligar o banco envia os dados que estavam naquele navegador. Então abra primeiro no computador onde você já tem os clientes cadastrados.

## 3. (Opcional) Legenda com IA de verdade
Em **Settings > Environment Variables** adicione `ANTHROPIC_API_KEY` com sua chave da Anthropic e faça Redeploy.
Sem a chave, o sistema usa legendas-modelo prontas.

## Estrutura
- `index.html` — o sistema
- `api/state.js` — salva e lê clientes, membros e posts
- `api/img.js` — salva e entrega as imagens
- `api/caption.js` — gera a legenda com IA (opcional)
