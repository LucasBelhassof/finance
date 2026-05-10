CREATE TABLE IF NOT EXISTS import_mapping_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  parser_id TEXT NOT NULL,
  header_signature TEXT NOT NULL,
  sheet_name TEXT,
  source_kind TEXT,
  institution_name TEXT,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_mapping_templates_user_file_signature
ON import_mapping_templates (user_id, file_type, header_signature, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_mapping_templates_user_parser
ON import_mapping_templates (user_id, parser_id, updated_at DESC);
