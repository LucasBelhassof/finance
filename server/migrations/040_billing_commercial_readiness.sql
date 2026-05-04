CREATE TABLE IF NOT EXISTS billing_plans (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_plan_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval_unit TEXT NOT NULL DEFAULT 'month' CHECK (interval_unit IN ('month', 'year')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_plans (
  id,
  provider,
  provider_plan_id,
  name,
  description,
  amount,
  currency,
  interval_unit,
  interval_count,
  features,
  active
)
VALUES (
  'premium_monthly',
  'asaas',
  NULLIF(current_setting('app.asaas_premium_plan_id', TRUE), ''),
  'Finly Premium',
  'IA, importacoes avancadas, automacoes e integracoes financeiras.',
  29.90,
  'BRL',
  'month',
  1,
  '["ai_chat", "plans_ai", "import_ai", "bulk_import", "insights_advanced", "bank_integrations"]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing_customers (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_customer_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_customers_provider_customer
ON billing_customers (provider, provider_customer_id)
WHERE provider_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES billing_customers(id) ON DELETE SET NULL,
  plan_id TEXT NOT NULL REFERENCES billing_plans(id),
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_subscription_id TEXT,
  provider_checkout_id TEXT,
  provider_checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active', 'past_due', 'canceled', 'inactive', 'pending')),
  provider_status TEXT,
  current_period_start DATE,
  current_period_end DATE,
  next_due_date DATE,
  activated_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_subscription
ON billing_subscriptions (provider, provider_subscription_id)
WHERE provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_checkout
ON billing_subscriptions (provider, provider_checkout_id)
WHERE provider_checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status
ON billing_subscriptions (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subscription_id BIGINT REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  provider_subscription_id TEXT,
  provider_checkout_id TEXT,
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'ignored', 'failed')),
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user_created
ON billing_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_type_created
ON billing_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subscription_id BIGINT REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_user_created
ON billing_audit_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_policy_acceptances (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_policy_acceptances_user_created
ON user_policy_acceptances (user_id, accepted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_policy_acceptances_unique_versions
ON user_policy_acceptances (user_id, terms_version, privacy_version);
