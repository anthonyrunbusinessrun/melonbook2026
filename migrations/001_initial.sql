-- MelonOps Initial Schema
-- Raymon J Land Watermelon Sales & Land Truck Brokers
-- Internal Operations System

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'accounting', 'sales_logistics', 'readonly');
CREATE TYPE sync_origin AS ENUM ('airtable', 'postgres', 'seed', 'import');
CREATE TYPE sync_direction AS ENUM ('at_to_pg', 'pg_to_at', 'reconcile');
CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE conflict_winner AS ENUM ('postgres', 'airtable');

-- ============================================================
-- APP USERS
-- ============================================================
CREATE TABLE app_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'readonly',
  hashed_password TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SYNC METADATA (included on every synced table via columns)
-- ============================================================

-- ============================================================
-- CONTACTS (Customers, Vendors, Freight Carriers)
-- ============================================================
CREATE TABLE contacts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Airtable sync
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblqy4XXa2ap3g66T',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  -- Core fields
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  entity_company_name   TEXT,
  contact_type          TEXT,  -- singleSelect from Airtable
  is_customer           BOOLEAN NOT NULL DEFAULT false,
  is_vendor             BOOLEAN NOT NULL DEFAULT false,
  is_freight            BOOLEAN NOT NULL DEFAULT false,
  is_first_handler      BOOLEAN NOT NULL DEFAULT false,
  is_location           BOOLEAN NOT NULL DEFAULT false,
  -- Contact info
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  phone1                TEXT,
  phone1_title          TEXT,
  phone2                TEXT,
  phone2_title          TEXT,
  phone3                TEXT,
  phone3_title          TEXT,
  email                 TEXT,
  notes                 TEXT,
  -- Financial
  ar_limit              NUMERIC(12,2),
  ar_terms              INTEGER,  -- days
  ap_limit              NUMERIC(12,2),
  ap_terms              INTEGER,
  -- Form printing
  forms_name_line1      TEXT,
  forms_name_line2      TEXT,
  forms_address         TEXT,
  forms_phones          TEXT,
  forms_footer          TEXT,
  forms_footer_phone    TEXT,
  forms_footer_site     TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contacts_code ON contacts(code);
CREATE INDEX idx_contacts_is_customer ON contacts(is_customer) WHERE is_customer = true;
CREATE INDEX idx_contacts_airtable ON contacts(airtable_record_id);

-- ============================================================
-- ACCOUNTS (Chart of Accounts)
-- ============================================================
CREATE TABLE accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblmt7JoM80l0vO5I',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  -- Core
  acct_code             TEXT,  -- formula: Co-No
  company_code          TEXT,
  acct_no               INTEGER NOT NULL,
  title                 TEXT NOT NULL,
  acct_type             TEXT,
  def_type              TEXT,
  is_frequent           BOOLEAN DEFAULT false,
  stmt                  TEXT,
  -- Computed from transactions (cached)
  debits                NUMERIC(14,2) DEFAULT 0,
  credits               NUMERIC(14,2) DEFAULT 0,
  balance               NUMERIC(14,2) DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_accounts_no ON accounts(acct_no);
CREATE INDEX idx_accounts_airtable ON accounts(airtable_record_id);

-- ============================================================
-- FORMS (Invoice/Document Templates)
-- ============================================================
CREATE TABLE forms (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tbl4vy605bt4KPDgA',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  code                  TEXT NOT NULL,
  form_type             TEXT,
  form_title            TEXT,
  long_title            TEXT,
  style                 TEXT,
  group_type            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ITEMS (SKU / Product catalog)
-- ============================================================
CREATE TABLE items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblOarNFTnDsSaO75',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  sku                   TEXT NOT NULL,
  item_type             TEXT,
  short_title           TEXT,
  long_title            TEXT,
  title                 TEXT,
  uom                   TEXT,
  lbs                   NUMERIC(8,2),
  dims                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BATCHES (Product Lot / TLC Barcode batches)
-- ============================================================
CREATE TABLE batches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblIdxdCej9QvdirO',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  tlc                   TEXT,
  batch_date            DATE,
  batch_no              TEXT,
  plu                   TEXT,
  gtin                  TEXT,
  upc                   TEXT,
  desc_large            TEXT,
  desc_small            TEXT,
  desc_sub              TEXT,
  origin                TEXT,
  packer                TEXT,
  vpc                   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FOLIOS (Loads / Shipments)
-- ============================================================
CREATE TABLE folios (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblxvWCSHdMKiOa56',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  folio_code            TEXT,  -- computed: type-no
  folio_type            TEXT,
  folio_no              TEXT,
  stage                 TEXT,
  load_date             DATE,
  sort_order            INTEGER,
  quick_look            TEXT,
  operations_notes      TEXT,
  rating                INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_folios_no ON folios(folio_no);
CREATE INDEX idx_folios_airtable ON folios(airtable_record_id);

-- ============================================================
-- VOUCHERS (Invoice / Payment Documents)
-- ============================================================
CREATE TABLE vouchers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblUYAd8KBsZi97Pu',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  -- Airtable auto-number
  voucher_seq           INTEGER,
  voucher_code          TEXT,  -- computed formula
  -- Links
  company_id            UUID REFERENCES contacts(id),
  issued_contact_id     UUID REFERENCES contacts(id),
  performed_contact_id  UUID REFERENCES contacts(id),
  via_contact_id        UUID REFERENCES contacts(id),
  form_id               UUID REFERENCES forms(id),
  folio_id              UUID REFERENCES folios(id),
  -- Core fields
  status                TEXT,
  reference1            TEXT,   -- R# (route/load ref)
  reference2            TEXT,   -- PO# or secondary ref
  ck_no                 TEXT,   -- Check number (1st)
  ck_no2                TEXT,   -- Check number (2nd)
  seal_no               TEXT,
  tracking_no           TEXT,
  resource              TEXT,
  via_free_entry        TEXT,
  -- Dates
  accrue_date           DATE,   -- Invoice date
  placed_date           DATE,
  perform_on            TIMESTAMPTZ,
  cleared_date          DATE,   -- Deposit/payment cleared date
  -- Financials (rolled up from transactions)
  debit                 NUMERIC(12,2) DEFAULT 0,
  credit                NUMERIC(12,2) DEFAULT 0,
  balance               NUMERIC(12,2) DEFAULT 0,
  -- AR-specific computed fields (for quick lookup)
  invoiced_amount       NUMERIC(12,2) DEFAULT 0,
  invoice_credits       NUMERIC(12,2) DEFAULT 0,
  total_invoiced        NUMERIC(12,2) DEFAULT 0,
  unloading_fee         NUMERIC(12,2) DEFAULT 0,
  adjustments           NUMERIC(12,2) DEFAULT 0,
  amount_paid           NUMERIC(12,2) DEFAULT 0,
  balance_due           NUMERIC(12,2) DEFAULT 0,
  -- Deposit info
  dep_no                TEXT,   -- Deposit number (REG-XX, PNC-XX)
  dep_date              DATE,
  -- Division / lot info (looked up from folio/batch)
  division              TEXT,
  lot_no                TEXT,
  r_no                  TEXT,
  memo                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vouchers_company ON vouchers(company_id);
CREATE INDEX idx_vouchers_issued ON vouchers(issued_contact_id);
CREATE INDEX idx_vouchers_accrue ON vouchers(accrue_date);
CREATE INDEX idx_vouchers_airtable ON vouchers(airtable_record_id);
CREATE INDEX idx_vouchers_lot ON vouchers(lot_no);
CREATE INDEX idx_vouchers_r_no ON vouchers(r_no);
CREATE INDEX idx_vouchers_status ON vouchers(status);

-- ============================================================
-- TRANSACTIONS (Double-entry ledger lines)
-- ============================================================
CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_record_id    TEXT UNIQUE,
  airtable_table_id     TEXT DEFAULT 'tblfNYrQKvtOwslbr',
  airtable_updated_at   TIMESTAMPTZ,
  postgres_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at        TIMESTAMPTZ,
  field_hash            TEXT,
  sync_origin           sync_origin NOT NULL DEFAULT 'postgres',
  deleted_at            TIMESTAMPTZ,
  -- Computed key
  trans_no              TEXT,   -- formula: DR/CR + acct_no + - + auto_id
  trans_seq             INTEGER,
  vch_line              TEXT,
  -- Links
  voucher_id            UUID REFERENCES vouchers(id),
  account_id            UUID REFERENCES accounts(id),
  item_id               UUID REFERENCES items(id),
  batch_id              UUID REFERENCES batches(id),
  -- Denormalized for performance
  account_no            INTEGER,
  account_name          TEXT,
  account_type          TEXT,
  voucher_code          TEXT,
  folio_ref             TEXT,
  -- Core financial
  debit                 NUMERIC(12,2),
  credit                NUMERIC(12,2),
  dr_qty                NUMERIC(10,2),
  cr_qty                NUMERIC(10,2),
  rate                  NUMERIC(10,4),
  flat                  NUMERIC(10,2),
  memo                  TEXT,
  -- Lookups
  ref1                  TEXT,
  ref2                  TEXT,
  status                TEXT,
  accrue_date           DATE,
  cleared_date          DATE,
  via_free_entry        TEXT,
  via_resource          TEXT,
  tracking_no           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_transactions_voucher ON transactions(voucher_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_account_no ON transactions(account_no);
CREATE INDEX idx_transactions_accrue ON transactions(accrue_date);
CREATE INDEX idx_transactions_airtable ON transactions(airtable_record_id);
-- For AR queries (acct 1152 = AR, acct 1122 = Undeposited Funds)
CREATE INDEX idx_transactions_ar ON transactions(account_no) WHERE account_no IN (1152, 1122, 1310, 1610, 1710);

-- ============================================================
-- SYNC INFRASTRUCTURE
-- ============================================================
CREATE TABLE sync_outbox (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name        TEXT NOT NULL,
  record_id         UUID NOT NULL,
  airtable_record_id TEXT,
  operation         TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload           JSONB NOT NULL,
  status            outbox_status NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  error_message     TEXT
);
CREATE INDEX idx_outbox_status ON sync_outbox(status, next_attempt_at) WHERE status IN ('pending', 'failed');

CREATE TABLE sync_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction         sync_direction NOT NULL,
  table_name        TEXT,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_failed    INTEGER NOT NULL DEFAULT 0,
  records_skipped   INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  metadata          JSONB
);
CREATE INDEX idx_sync_runs_started ON sync_runs(started_at DESC);

CREATE TABLE conflict_audit (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name        TEXT NOT NULL,
  record_id         UUID NOT NULL,
  airtable_record_id TEXT,
  pg_snapshot       JSONB NOT NULL,
  at_snapshot       JSONB NOT NULL,
  pg_updated_at     TIMESTAMPTZ,
  at_updated_at     TIMESTAMPTZ,
  winner            conflict_winner NOT NULL,
  resolved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by       TEXT DEFAULT 'system'
);
CREATE INDEX idx_conflicts_table ON conflict_audit(table_name, resolved_at DESC);

CREATE TABLE sync_webhook_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_base_id  TEXT NOT NULL,
  cursor            TEXT,
  event_type        TEXT,
  payload           JSONB,
  processed         BOOLEAN NOT NULL DEFAULT false,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);

-- ============================================================
-- AR REPORT CACHE (pre-computed for performance)
-- ============================================================
CREATE TABLE ar_report_cache (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date       DATE NOT NULL,
  customer_id       UUID REFERENCES contacts(id),
  customer_code     TEXT NOT NULL,
  customer_name     TEXT NOT NULL,
  lot_no            TEXT,
  r_no              TEXT,
  misc_pas          TEXT,
  po_no             TEXT,
  inv_date          DATE,
  dep_no            TEXT,
  dep_date          DATE,
  check1            TEXT,
  check2            TEXT,
  invoiced          NUMERIC(12,2) DEFAULT 0,
  invoice_credits   NUMERIC(12,2) DEFAULT 0,
  total_invoiced    NUMERIC(12,2) DEFAULT 0,
  unloading_fee     NUMERIC(12,2) DEFAULT 0,
  adjustments       NUMERIC(12,2) DEFAULT 0,
  amount_paid       NUMERIC(12,2) DEFAULT 0,
  balance_due       NUMERIC(12,2) DEFAULT 0,
  memo              TEXT,
  division          TEXT,
  voucher_id        UUID REFERENCES vouchers(id),
  airtable_voucher_id TEXT,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ar_cache_customer ON ar_report_cache(customer_code, report_date);
CREATE INDEX idx_ar_cache_date ON ar_report_cache(report_date DESC);
CREATE INDEX idx_ar_cache_balance ON ar_report_cache(balance_due) WHERE balance_due != 0;

-- ============================================================
-- ANOMALY FLAGS
-- ============================================================
CREATE TABLE anomaly_flags (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name        TEXT NOT NULL,
  record_id         UUID,
  airtable_record_id TEXT,
  flag_type         TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  description       TEXT NOT NULL,
  resolved          BOOLEAN NOT NULL DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES app_users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_anomalies_unresolved ON anomaly_flags(resolved, created_at DESC) WHERE resolved = false;

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES app_users(id),
  user_email        TEXT,
  action            TEXT NOT NULL,
  table_name        TEXT,
  record_id         UUID,
  old_values        JSONB,
  new_values        JSONB,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.postgres_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all synced tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','accounts','forms','items','batches','folios','vouchers','transactions']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END$$;

-- Trigger to write to outbox on postgres-originated changes
CREATE OR REPLACE FUNCTION sync_outbox_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if this change came from airtable (prevent sync loops)
  IF (TG_OP = 'DELETE') THEN
    IF OLD.sync_origin = 'airtable' THEN RETURN OLD; END IF;
    INSERT INTO sync_outbox (table_name, record_id, airtable_record_id, operation, payload)
    VALUES (TG_TABLE_NAME, OLD.id, OLD.airtable_record_id, 'delete', row_to_json(OLD)::jsonb);
    RETURN OLD;
  END IF;
  IF NEW.sync_origin = 'airtable' THEN
    RETURN NEW;
  END IF;
  INSERT INTO sync_outbox (table_name, record_id, airtable_record_id, operation, payload)
  VALUES (TG_TABLE_NAME, NEW.id, NEW.airtable_record_id, TG_OP::TEXT::TEXT, row_to_json(NEW)::jsonb)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply outbox trigger to writable tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','vouchers','transactions']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_outbox AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION sync_outbox_trigger()', t, t);
  END LOOP;
END$$;

-- ============================================================
-- SEED: Default admin user (password: ChangeMe2026!)
-- ============================================================
INSERT INTO app_users (email, name, role, hashed_password) VALUES
('admin@raymonjland.com', 'System Admin', 'admin', '$2b$12$placeholder_will_be_replaced_on_first_run');

INSERT INTO app_users (email, name, role, hashed_password) VALUES
('accounting@raymonjland.com', 'Accounting', 'accounting', '$2b$12$placeholder_will_be_replaced_on_first_run');
