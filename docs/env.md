# Variáveis de ambiente

## Obrigatórias em produção

- `DATABASE_URL`: conexão PostgreSQL usada pelo backend.
- `APP_ORIGIN`: origem exata do frontend autorizada no CORS e cookies.
- `JWT_ACCESS_SECRET`: segredo do access token.
- `JWT_REFRESH_SECRET`: segredo do refresh token.
- `APP_PUBLIC_URL`: URL pública do frontend para links comerciais e legais.
- `ASAAS_API_KEY`: chave do Asaas usada somente pelo backend.
- `ASAAS_WEBHOOK_TOKEN`: token esperado no header `asaas-access-token`.
- `BILLING_SUCCESS_URL`: destino depois de checkout pago/concluído.
- `BILLING_CANCEL_URL`: destino depois de checkout cancelado/expirado.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`: envio transacional mínimo.

## Runtime

- `NODE_ENV`: use `production` no deploy.
- `PORT`: porta HTTP do backend.
- `VITE_API_URL`: URL pública do backend para o frontend.
- `PASSWORD_RESET_BASE_URL`: URL base do reset de senha.
- `AUTH_REFRESH_COOKIE_NAME`: nome do cookie HttpOnly de refresh.

## Billing / Asaas

- `ASAAS_ENV`: `sandbox` ou `production`.
- `ASAAS_API_KEY`: não usar no frontend, scripts públicos ou logs.
- `ASAAS_WEBHOOK_TOKEN`: validar contra o header `asaas-access-token` recebido no webhook.
- `ASAAS_PREMIUM_PLAN_ID`: id externo opcional do plano premium no Asaas.
- `APP_PUBLIC_URL`: URL pública do app web.
- `BILLING_SUCCESS_URL`: normalmente `https://app.seudominio.com/profile`.
- `BILLING_CANCEL_URL`: normalmente `https://app.seudominio.com/precos`.

O plano interno `premium_monthly` é criado por migration. A fonte de verdade é `billing_subscriptions`; `users.is_premium` e `users.premium_since` são cache derivado.

## Email transacional

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Sem SMTP configurado, o backend não quebra a requisição, mas registra warning e não envia reset de senha, confirmação de signup nem avisos de billing.

## IA

Defaults seguros:

- `CHAT_AI_ENABLED=false`
- `IMPORT_AI_ENABLED=false`

Observações:

- chat só liga quando `CHAT_AI_ENABLED=true`
- import AI só liga quando `IMPORT_AI_ENABLED=true`
- a presença de API key sozinha não habilita IA

## Chaves opcionais de provider

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `IMPORT_AI_WEBHOOK_URL`

## Exemplo mínimo de produção

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://user:password@db:5432/finly
APP_ORIGIN=https://app.seudominio.com
JWT_ACCESS_SECRET=troque-por-um-segredo-longo
JWT_REFRESH_SECRET=troque-por-outro-segredo-longo
APP_PUBLIC_URL=https://app.seudominio.com
ASAAS_ENV=sandbox
ASAAS_API_KEY=troque-pela-chave-do-asaas
ASAAS_WEBHOOK_TOKEN=troque-pelo-token-do-webhook
BILLING_SUCCESS_URL=https://app.seudominio.com/profile
BILLING_CANCEL_URL=https://app.seudominio.com/precos
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_FROM="Finly <no-reply@seudominio.com>"
CHAT_AI_ENABLED=false
IMPORT_AI_ENABLED=false
```
