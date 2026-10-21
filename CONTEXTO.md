# Rastreador de Posts · QH4

Painel interno da agência QH4 para controlar os posts mensais de cada cliente (marmorarias) por squad e membro. Funciona no desktop e no celular. Está publicado na Vercel e tem banco online compartilhado.

## Identidade visual
- Cores: laranja #ff7a1a sobre preto (#0a0a0a, cards #131313).
- Fontes: Poppins nos títulos e Inter nos textos.

## Equipe (fixa no código)
- Squad A: Samuel, Gabriel
- Squad B: Cleiton, Marco
- Squad C: Arthur, Caique
- Squad D: Guilherme
- O sistema começa sem clientes. Eles são cadastrados pela tela, um por membro.

## Telas
1. **Dashboard**: total de clientes, posts no mês, % de conclusão da agência no mês, lista "Clientes cadastrados" com os botões Abrir e Excluir, e lista de clientes atrasados.
2. **Posts**: filtro por squad (A, B, C, D), depois membro, cliente, ano e mês. Mostra busca por nome do cliente, lembrete fixo do cliente, atraso, e os status realizado, pendente e publicado. Para adicionar um post: imagem + legenda manual + Salvar. O post vai para Criativos.
3. **Criativos**: posts salvos por membro e cliente, em prévia de feed.
4. **Clientes e Equipe**: cadastrar, editar e excluir clientes (nome, quantidade de posts por mês, membro, telefone, lembrete).

Removidos a pedido do usuário: Relatórios e legenda com IA (não funcionou e foi retirada).

## Arquitetura
- `fonte/Rastreador de Posts v3.dc.html`: código-fonte. É um "Design Component" com template HTML de estilos inline e uma classe JS `Component` (estado, lógica e sincronização). Precisa do `support.js` ao lado para abrir.
- `vercel/index.html`: o mesmo sistema compilado num arquivo único. É o que vai para o ar.
- `vercel/api/*.js`: funções serverless da Vercel.
  - `state.js`: GET/POST da configuração (squads, membros, clientes) e dos posts, com controle de versão.
  - `img.js`: guarda as imagens dos posts separadamente.
  - `_redis.js`: conexão com o Upstash Redis (variáveis KV_REST_API_URL/TOKEN ou UPSTASH_REDIS_REST_URL/TOKEN) e leitura do corpo da requisição.
- Sincronização: cada alteração vai para o banco e os outros usuários recebem em cerca de 4 s, sem recarregar. Também há cópia local no navegador (localStorage, chaves `qh4x-cfg` e `qh4x-data`). Se o Redis não estiver conectado, aparece um aviso vermelho no topo.
- `meta.wipe` na configuração serve para zerar o banco uma única vez. Ao mudar o número, o banco é zerado de novo.

## Deploy
Subir a pasta `vercel/` na Vercel, conectar o Upstash for Redis em Storage e fazer Redeploy. Detalhes no `vercel/LEIA-ME.md`.
