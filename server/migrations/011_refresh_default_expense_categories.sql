INSERT INTO categories (
  slug,
  label,
  transaction_type,
  icon,
  color,
  group_slug,
  group_label,
  group_color,
  sort_order
)
VALUES
  ('outros-despesas', 'Outros', 'expense', 'Wallet', '#64748b', 'outros-despesas', 'Outros', '#64748b', 10),
  ('transporte', 'Transporte', 'expense', 'Car', '#0ea5e9', 'transporte', 'Transporte', '#0ea5e9', 20),
  ('alimentacao', 'Alimentação', 'expense', 'Utensils', '#f59e0b', 'alimentacao', 'Alimentação', '#f59e0b', 30),
  ('supermercado', 'Supermercado', 'expense', 'ShoppingCart', '#84cc16', 'supermercado', 'Supermercado', '#84cc16', 40),
  ('assinaturas', 'Assinaturas', 'expense', 'Smartphone', '#8b5cf6', 'assinaturas', 'Assinaturas', '#8b5cf6', 50),
  ('lazer', 'Lazer', 'expense', 'Sparkles', '#ec4899', 'lazer', 'Lazer', '#ec4899', 60),
  ('compras', 'Compras', 'expense', 'ShoppingBag', '#f97316', 'compras', 'Compras', '#f97316', 70),
  ('saude', 'Saúde', 'expense', 'Heart', '#14b8a6', 'saude', 'Saúde', '#14b8a6', 80)
ON CONFLICT (slug)
DO UPDATE SET
  label = EXCLUDED.label,
  transaction_type = EXCLUDED.transaction_type,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  group_slug = EXCLUDED.group_slug,
  group_label = EXCLUDED.group_label,
  group_color = EXCLUDED.group_color,
  sort_order = EXCLUDED.sort_order;
