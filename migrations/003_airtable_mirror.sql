-- Raw Airtable mirror layer.
-- This preserves every Airtable table, field, view, and record even when the
-- normalized MelonOps schema does not yet map a field.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS airtable_tables (
  base_id           TEXT NOT NULL,
  table_id          TEXT PRIMARY KEY,
  table_name        TEXT NOT NULL,
  primary_field_id  TEXT,
  description       TEXT,
  raw_schema        JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airtable_fields (
  base_id         TEXT NOT NULL,
  table_id        TEXT NOT NULL REFERENCES airtable_tables(table_id) ON DELETE CASCADE,
  field_id        TEXT NOT NULL,
  field_name      TEXT NOT NULL,
  field_type      TEXT NOT NULL,
  field_options   JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_schema      JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at  TIMESTAMPTZ,
  PRIMARY KEY (table_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_airtable_fields_table ON airtable_fields(table_id, field_name);

CREATE TABLE IF NOT EXISTS airtable_views (
  base_id         TEXT NOT NULL,
  table_id        TEXT NOT NULL REFERENCES airtable_tables(table_id) ON DELETE CASCADE,
  view_id         TEXT NOT NULL,
  view_name       TEXT NOT NULL,
  view_type       TEXT,
  raw_schema      JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at  TIMESTAMPTZ,
  PRIMARY KEY (table_id, view_id)
);
CREATE INDEX IF NOT EXISTS idx_airtable_views_table ON airtable_views(table_id, view_name);

CREATE TABLE IF NOT EXISTS airtable_records (
  base_id             TEXT NOT NULL,
  table_id            TEXT NOT NULL REFERENCES airtable_tables(table_id) ON DELETE CASCADE,
  record_id           TEXT NOT NULL,
  created_time        TIMESTAMPTZ,
  last_modified_time  TIMESTAMPTZ,
  raw_fields          JSONB NOT NULL DEFAULT '{}'::jsonb,
  searchable_text     TEXT NOT NULL DEFAULT '',
  last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_error          TEXT,
  PRIMARY KEY (table_id, record_id)
);
CREATE INDEX IF NOT EXISTS idx_airtable_records_table ON airtable_records(table_id, last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_airtable_records_search ON airtable_records USING gin (searchable_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_airtable_records_raw ON airtable_records USING gin (raw_fields);

CREATE TABLE IF NOT EXISTS airtable_sync_status (
  base_id            TEXT NOT NULL,
  table_id           TEXT NOT NULL PRIMARY KEY,
  table_name         TEXT NOT NULL,
  schema_synced_at   TIMESTAMPTZ,
  records_synced_at  TIMESTAMPTZ,
  record_count       INTEGER NOT NULL DEFAULT 0,
  last_started_at    TIMESTAMPTZ,
  last_completed_at  TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'pending',
  sync_error         TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airtable_view_stats (
  base_id         TEXT NOT NULL,
  table_id        TEXT NOT NULL,
  view_id         TEXT NOT NULL,
  view_name       TEXT NOT NULL,
  record_count    INTEGER NOT NULL DEFAULT 0,
  debit_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_error      TEXT,
  PRIMARY KEY (table_id, view_id)
);
