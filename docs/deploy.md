# Deploy do MVP

## Fluxo recomendado

1. Defina as variáveis obrigatórias do ambiente.
2. Execute `npm run build`.
3. Execute `npm run db:migrate`.
4. Configure o webhook Asaas apontando para `https://api.seudominio.com/api/webhooks/asaas`.
5. Suba o backend com `npm run server:start` ou via container Docker.
6. Valide `GET /api/health` e `GET /api/ready`.

## Docker

Build:

```bash
docker build -t finly:latest .
```

Run:

```bash
docker run --rm -p 3001:3001 --env-file .env finly:latest
```

Características do container:

- imagem multi-stage
- `NODE_ENV=production`
- processo como usuário `node`
- `HEALTHCHECK` nativo
- runtime com dependências de produção apenas

## Start command

- Local compilado: `npm run server:start`
- Container: `node dist-server/server.js`

## Checklist de smoke test

- `GET /api/health` responde `200`
- `GET /api/ready` responde `200` com banco acessível
- login e refresh funcionam
- criação de conta/categoria/transação funciona
- usuário comum continua bloqueado em `/api/admin`
- usuário free recebe `403 premium_required` em recursos premium
- checkout premium retorna URL do Asaas quando `ASAAS_API_KEY` está configurada
- webhook Asaas com `asaas-access-token` válido atualiza `billing_subscriptions`

## EasyPanel / Hostinger

Configuração mínima recomendada:

- build command: `npm run build`
- start command: `npm run server:start`
- healthcheck: `/api/health`
- readiness externo/monitoramento: `/api/ready`
- domínio com HTTPS antes de habilitar checkout público
- `APP_ORIGIN`, `APP_PUBLIC_URL`, `VITE_API_URL`, `BILLING_SUCCESS_URL` e `BILLING_CANCEL_URL` apontando para URLs públicas reais
- `ASAAS_ENV=production` somente depois de validar em sandbox
- `ASAAS_WEBHOOK_TOKEN` igual ao token configurado no painel Asaas

Para rollback, volte a tag/imagem anterior e mantenha migrations aplicadas. Se o problema envolver schema, faça forward-fix com nova migration.

## Monitoramento

- monitor externo a cada 1 minuto em `/api/health`
- monitor externo a cada 1 a 5 minutos em `/api/ready`
- alerta para falha de webhook Asaas e aumento de `payment_failed`
- alerta para erro SMTP em reset de senha e eventos de billing

## Rollback básico

1. Volte para a imagem/tag anterior.
2. Não remova migrations já aplicadas.
3. Se houver falha operacional após migration, trate como forward-fix com nova migration.
