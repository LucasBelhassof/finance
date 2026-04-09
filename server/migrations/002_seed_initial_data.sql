INSERT INTO users (name)
SELECT 'Joao'
WHERE NOT EXISTS (
  SELECT 1
  FROM users
);

INSERT INTO categories (
  slug,
  label,
  icon,
  color,
  group_slug,
  group_label,
  group_color,
  sort_order
)
VALUES
  ('supermercado', 'Supermercado', 'ShoppingCart', 'text-primary', 'alimentacao', 'Alimentacao', 'bg-warning', 10),
  ('cafe', 'Cafe & Lanches', 'Coffee', 'text-warning', 'alimentacao', 'Alimentacao', 'bg-warning', 20),
  ('transporte', 'Transporte', 'Car', 'text-info', 'transporte', 'Transporte', 'bg-info', 30),
  ('energia', 'Energia', 'Zap', 'text-warning', 'moradia', 'Moradia', 'bg-primary', 40),
  ('moradia', 'Moradia', 'Home', 'text-primary', 'moradia', 'Moradia', 'bg-primary', 50),
  ('restaurantes', 'Restaurantes', 'Utensils', 'text-expense', 'alimentacao', 'Alimentacao', 'bg-warning', 60),
  ('assinaturas', 'Assinaturas', 'Smartphone', 'text-info', 'outros', 'Outros', 'bg-muted-foreground', 70),
  ('saude', 'Saude', 'Heart', 'text-income', 'saude', 'Saude', 'bg-income', 80),
  ('lazer', 'Lazer', 'Sparkles', 'text-expense', 'lazer', 'Lazer', 'bg-expense', 90),
  ('salario', 'Salario', 'Wallet', 'text-income', 'receitas', 'Receitas', 'bg-income', 100),
  ('freelance', 'Freelance', 'TrendingUp', 'text-income', 'receitas', 'Receitas', 'bg-income', 110)
ON CONFLICT (slug)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  group_slug = EXCLUDED.group_slug,
  group_label = EXCLUDED.group_label,
  group_color = EXCLUDED.group_color,
  sort_order = EXCLUDED.sort_order;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
summary_rows AS (
  SELECT *
  FROM (
    VALUES
      ('2026-03-01'::DATE, 12158.20::NUMERIC(12, 2), 7800.00::NUMERIC(12, 2), 4990.00::NUMERIC(12, 2)),
      ('2026-04-01'::DATE, 12450.00::NUMERIC(12, 2), 8200.00::NUMERIC(12, 2), 4830.00::NUMERIC(12, 2))
  ) AS rows(month_start, total_balance, total_income, total_expenses)
)
INSERT INTO monthly_summaries (
  user_id,
  month_start,
  total_balance,
  total_income,
  total_expenses
)
SELECT
  user_row.id,
  summary_rows.month_start,
  summary_rows.total_balance,
  summary_rows.total_income,
  summary_rows.total_expenses
FROM user_row
CROSS JOIN summary_rows
ON CONFLICT (user_id, month_start)
DO UPDATE SET
  total_balance = EXCLUDED.total_balance,
  total_income = EXCLUDED.total_income,
  total_expenses = EXCLUDED.total_expenses;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
insight_rows AS (
  SELECT *
  FROM (
    VALUES
      ('budget-restaurants', 'Gasto acima do orcamento', 'Seus gastos com restaurantes ultrapassaram o limite mensal de R$ 500 em 23%.', 'Atencao', 'warning', 10),
      ('unused-subscriptions', 'Economia identificada', 'Voce pode economizar R$ 180/mes cancelando 2 assinaturas pouco utilizadas.', 'Oportunidade', 'success', 20),
      ('emergency-fund', 'Meta de reserva', 'Com o ritmo atual, voce atinge sua reserva de emergencia em 4 meses.', 'Meta', 'info', 30),
      ('uber-pattern', 'Padrao detectado', 'Seus gastos com Uber aumentam 40% nas sextas. Considere alternativas.', 'Padrao', 'primary', 40)
  ) AS rows(seed_key, title, description, tag, tone, sort_order)
)
INSERT INTO insights (
  user_id,
  seed_key,
  title,
  description,
  tag,
  tone,
  sort_order
)
SELECT
  user_row.id,
  insight_rows.seed_key,
  insight_rows.title,
  insight_rows.description,
  insight_rows.tag,
  insight_rows.tone,
  insight_rows.sort_order
FROM user_row
CROSS JOIN insight_rows
ON CONFLICT (user_id, seed_key)
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  tag = EXCLUDED.tag,
  tone = EXCLUDED.tone,
  sort_order = EXCLUDED.sort_order;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
chat_rows AS (
  SELECT *
  FROM (
    VALUES
      ('chat-assistant-1', 'assistant', 'Ola Joao! Analisei suas financas deste mes. Voce gastou 12% a mais em alimentacao comparado ao mes passado. Quer que eu sugira formas de economizar?'),
      ('chat-user-1', 'user', 'Sim, por favor! Quero reduzir meus gastos com delivery.'),
      ('chat-assistant-2', 'assistant', E'Otimo! Aqui vao 3 dicas:\n\n1. Cozinhe em lotes no domingo e economize cerca de R$ 400/mes.\n2. Use cupons nos apps de delivery para pedidos essenciais.\n3. Defina um limite semanal de R$ 80 para delivery.\n\nIsso pode gerar uma economia de ate R$ 600/mes.')
  ) AS rows(seed_key, role, content)
)
INSERT INTO chat_messages (
  user_id,
  seed_key,
  role,
  content
)
SELECT
  user_row.id,
  chat_rows.seed_key,
  chat_rows.role,
  chat_rows.content
FROM user_row
CROSS JOIN chat_rows
ON CONFLICT (user_id, seed_key)
DO UPDATE SET
  role = EXCLUDED.role,
  content = EXCLUDED.content;
