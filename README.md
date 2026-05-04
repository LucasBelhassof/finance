# Finly

Aplicação full-stack de finanças pessoais com frontend React/Vite e backend Express/PostgreSQL.

## Modelo comercial

O MVP opera em modelo freemium:

- Free: CRUD financeiro básico, dashboard, contas, categorias e transações manuais.
- Premium: IA, revisão/geração de planos, importação com IA, importação em massa, insights avançados e integrações bancárias quando habilitadas.

Assinaturas usam Asaas no backend. O frontend nunca recebe `ASAAS_API_KEY`; ele chama `/api/billing/checkout` e é redirecionado para o checkout do provedor. `users.is_premium` permanece como cache derivado de `billing_subscriptions`.

## MVP em produção

Requisitos:

- Node.js 22+
- PostgreSQL acessível no `DATABASE_URL`

Subida local:

```bash
npm install
npm run db:migrate
npm run server:dev
```

Em outro terminal:

```bash
npm run dev
```

Build de produção:

```bash
npm run build
npm run server:start
```

## Docker

Build:

```bash
docker build -t finly:latest .
```

Run:

```bash
docker run --rm -p 3001:3001 --env-file .env finly:latest
```

O container sobe com:

- `NODE_ENV=production`
- usuário não-root
- `HEALTHCHECK` em `GET /api/health`
- runtime sem `devDependencies`

## Qualidade

```bash
npm run format
npm run lint
npm run test
npm run build
```

## Endpoints operacionais

- `GET /api/health`: liveness leve, sem validar banco
- `GET /api/ready`: readiness com validação de banco

## Variáveis críticas

- `DATABASE_URL`
- `APP_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `APP_PUBLIC_URL`
- `BILLING_SUCCESS_URL`
- `BILLING_CANCEL_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM`

IA fica desligada por padrão. Para habilitar:

- `CHAT_AI_ENABLED=true`
- `IMPORT_AI_ENABLED=true`

Recursos de IA continuam protegidos por gate premium no backend.

## Documentação

- [Deploy](docs/deploy.md)
- [Variáveis de ambiente](docs/env.md)
- [Segurança operacional](docs/security.md)
- [Banco e migrations](docs/database.md)
- [Termos de uso](docs/legal/terms.md)
- [Política de privacidade](docs/legal/privacy.md)
- [Política de cancelamento](docs/legal/cancellation.md)
