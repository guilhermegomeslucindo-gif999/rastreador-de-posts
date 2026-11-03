# Como configurar a IA para gerar legendas

## Passo a passo (5 minutos)

1. Acesse: https://platform.openai.com/api-keys
2. Clique em "Create new secret key"
3. Dê um nome: "Rastreador de Posts"
4. Copie a chave gerada (começa com `sk-...`)

5. Acesse seu projeto na Vercel: https://vercel.com
6. Clique no projeto "rastreador-de-posts"
7. Vá em **Settings** (configurações)
8. Clique em **Environment Variables**
9. Adicione uma nova variável:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** sua chave `sk-...`
   - Deixe marcado: Production, Preview, Development
10. Clique em **Save**
11. Vá em **Deployments** e clique em **Redeploy** no deploy mais recente

Pronto! O botão "Gerar legenda com IA" vai funcionar.

## Custo estimado
- GPT-4o com visão: ~$0.01 a $0.03 por geração
- 100 gerações por mês = menos de $3
