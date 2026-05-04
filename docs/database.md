# Banco e migrations

## Bootstrap

Fluxo padrão:

```bash
npm run db:migrate
```

As migrations são controladas por `schema_migrations` e aplicadas em ordem lexicográfica do nome do arquivo.

## Banco vazio

- o banco vazio sobe pela sequência atual de migrations
- existe uma migration final de limpeza (`039_cleanup_legacy_demo_seed.sql`) para remover o seed legado de demonstração quando o banco foi criado do zero com os dados históricos antigos

## Seed de categorias por usuário

- o seed padrão de categorias usa `ON CONFLICT (user_id, slug) DO NOTHING`
- signup continua transacional; se o seed falhar, a criação do usuário não deve ficar parcial

## Billing e aceite legal

- `billing_plans` mantém o plano interno `premium_monthly`
- `billing_customers` vincula usuário ao customer do provedor
- `billing_subscriptions` é a fonte de verdade para premium
- `billing_events` deduplica webhooks por `(provider, provider_event_id)`
- `billing_audit_logs` preserva histórico de mudança de status
- `user_policy_acceptances` guarda versão de Termos/Privacidade aceita no signup
- `users.is_premium` e `users.premium_since` devem ser tratados como cache derivado

## Backup e restore

Backup lógico recomendado:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=finly-$(date +%Y%m%d-%H%M%S).dump
```

Armazenar o arquivo fora da VPS, com criptografia e retenção definida. Teste de restore em ambiente isolado:

```bash
createdb finly_restore_test
pg_restore --dbname=finly_restore_test --clean --if-exists finly-YYYYMMDD-HHMMSS.dump
npm run db:migrate
```

Não considerar backup válido sem teste periódico de restore.

## Riscos operacionais conhecidos

- existem migrations históricas com prefixo numérico duplicado (`011_*`)
- como a ordem é lexicográfica por filename, não renomeie migrations antigas já aplicadas em ambientes existentes
- o seed histórico em `002_seed_initial_data.sql` fazia sentido no bootstrap legado; o MVP atual depende da limpeza posterior e do seed por usuário no fluxo de signup/bootstrap

## Regras de operação

- não editar migrations antigas já aplicadas
- qualquer ajuste novo deve entrar em migration nova
- rollback de dados deve ser tratado como forward-fix sempre que possível
