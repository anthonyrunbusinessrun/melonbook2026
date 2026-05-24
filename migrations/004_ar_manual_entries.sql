-- Manual AR input layer based on the legacy 2026 AR Spreadsheet.
-- These rows are intentionally spreadsheet-shaped so accounting staff can
-- enter or stage AR exactly as they are used to seeing it.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';

CREATE TABLE IF NOT EXISTS ar_manual_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ar_year             INTEGER NOT NULL DEFAULT 2026,
  entry_status        TEXT NOT NULL DEFAULT 'draft' CHECK (entry_status IN ('draft', 'posted', 'void')),

  -- Airtable sync metadata, populated when a matching Airtable record exists.
  airtable_record_id  TEXT,
  airtable_table_id   TEXT,
  raw_fields          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_origin         sync_origin NOT NULL DEFAULT 'postgres',
  last_synced_at      TIMESTAMPTZ,

  -- Legacy AR spreadsheet columns A-S.
  customer_code       TEXT NOT NULL,
  customer_name       TEXT,
  division            TEXT,
  lot_no              TEXT,
  r_no                TEXT,
  misc_pas            TEXT,
  po_no               TEXT,
  inv_date            DATE,
  dep_no              TEXT,
  dep_date            DATE,
  check1              TEXT,
  check2              TEXT,
  invoiced            NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_credits     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_invoiced      NUMERIC(12,2) GENERATED ALWAYS AS (
    COALESCE(invoiced, 0) + COALESCE(invoice_credits, 0)
  ) STORED,
  unloading_fee       NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments         NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due         NUMERIC(12,2) GENERATED ALWAYS AS (
    COALESCE(invoiced, 0) + COALESCE(invoice_credits, 0) +
    COALESCE(unloading_fee, 0) + COALESCE(adjustments, 0) -
    COALESCE(amount_paid, 0)
  ) STORED,
  memo                TEXT,

  created_by          UUID REFERENCES app_users(id),
  updated_by          UUID REFERENCES app_users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_manual_customer ON ar_manual_entries(customer_code, ar_year);
CREATE INDEX IF NOT EXISTS idx_ar_manual_balance ON ar_manual_entries(balance_due) WHERE balance_due <> 0;
CREATE INDEX IF NOT EXISTS idx_ar_manual_airtable ON ar_manual_entries(airtable_record_id);
CREATE INDEX IF NOT EXISTS idx_ar_manual_created ON ar_manual_entries(created_at DESC);

CREATE OR REPLACE FUNCTION update_ar_manual_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ar_manual_entries_updated ON ar_manual_entries;
CREATE TRIGGER trg_ar_manual_entries_updated
  BEFORE UPDATE ON ar_manual_entries
  FOR EACH ROW EXECUTE FUNCTION update_ar_manual_entries_updated_at();
