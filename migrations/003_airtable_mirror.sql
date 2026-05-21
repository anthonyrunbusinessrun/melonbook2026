-- Migration 003: Airtable raw record mirror + schema cache + sync status

-- Raw record mirror (stores ALL Airtable records from ALL tables)
CREATE TABLE IF NOT EXISTS airtable_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_id             TEXT NOT NULL DEFAULT 'appmnU55C5f7A50U4',
  table_id            TEXT NOT NULL,
  table_name          TEXT NOT NULL,
  airtable_record_id  TEXT NOT NULL,
  created_time        TIMESTAMPTZ,
  raw_fields          JSONB NOT NULL DEFAULT '{}',
  searchable_text     TEXT GENERATED ALWAYS AS (
    substring(raw_fields::text, 1, 10000)
  ) STORED,
  last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_error          TEXT,
  UNIQUE(table_id, airtable_record_id)
);

CREATE INDEX IF NOT EXISTS idx_airtable_records_table_id ON airtable_records(table_id);
CREATE INDEX IF NOT EXISTS idx_airtable_records_at_id ON airtable_records(airtable_record_id);
CREATE INDEX IF NOT EXISTS idx_airtable_records_synced ON airtable_records(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_airtable_records_search ON airtable_records USING gin(raw_fields);

-- Table/view schema cache
CREATE TABLE IF NOT EXISTS airtable_schema_cache (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_id     TEXT NOT NULL DEFAULT 'appmnU55C5f7A50U4',
  table_id    TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  fields      JSONB NOT NULL DEFAULT '[]',
  views       JSONB NOT NULL DEFAULT '[]',
  record_count INTEGER,
  cached_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(base_id, table_id)
);

-- Per-table sync status tracking
CREATE TABLE IF NOT EXISTS airtable_sync_status (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id        TEXT NOT NULL UNIQUE,
  table_name      TEXT NOT NULL,
  airtable_count  INTEGER,
  mirrored_count  INTEGER,
  last_synced_at  TIMESTAMPTZ,
  sync_started_at TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','done','error')),
  error_message   TEXT,
  duration_ms     INTEGER
);

-- Upsert initial status rows for all known tables
INSERT INTO airtable_sync_status (table_id, table_name) VALUES
  ('tblfNYrQKvtOwslbr', 'Transactions'),
  ('tblqy4XXa2ap3g66T', 'Contacts'),
  ('tblxvWCSHdMKiOa56', 'Folios'),
  ('tblUYAd8KBsZi97Pu', 'Vouchers'),
  ('tblmt7JoM80l0vO5I', 'Accounts'),
  ('tblIdxdCej9QvdirO', 'Batches'),
  ('tblOarNFTnDsSaO75', 'Items'),
  ('tbllwqsWIRSTKIVFf', 'Attachments'),
  ('tbl4vy605bt4KPDgA', 'Forms')
ON CONFLICT (table_id) DO NOTHING;

-- Add theme preference to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';

COMMENT ON TABLE airtable_records IS 'Full raw mirror of all Airtable records across all tables';
COMMENT ON TABLE airtable_schema_cache IS 'Cached Airtable table/field/view schema from Metadata API';
COMMENT ON TABLE airtable_sync_status IS 'Per-table sync progress and status tracking';
