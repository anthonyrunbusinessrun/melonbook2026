import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================
// TYPED QUERY HELPERS
// ============================================================

export type Contact = {
  id: string;
  airtable_record_id: string | null;
  code: string;
  name: string;
  entity_company_name: string | null;
  contact_type: string | null;
  is_customer: boolean;
  is_vendor: boolean;
  is_freight: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone1: string | null;
  email: string | null;
  ar_limit: number | null;
  ar_terms: number | null;
  notes: string | null;
  last_synced_at: string | null;
  postgres_updated_at: string;
  deleted_at: string | null;
};

export type Voucher = {
  id: string;
  airtable_record_id: string | null;
  voucher_seq: number | null;
  voucher_code: string | null;
  company_id: string | null;
  issued_contact_id: string | null;
  status: string | null;
  reference1: string | null;
  reference2: string | null;
  ck_no: string | null;
  ck_no2: string | null;
  accrue_date: string | null;
  cleared_date: string | null;
  dep_no: string | null;
  dep_date: string | null;
  lot_no: string | null;
  r_no: string | null;
  division: string | null;
  memo: string | null;
  invoiced_amount: number;
  invoice_credits: number;
  total_invoiced: number;
  unloading_fee: number;
  adjustments: number;
  amount_paid: number;
  balance_due: number;
  debit: number;
  credit: number;
  balance: number;
  last_synced_at: string | null;
  deleted_at: string | null;
};

export type Transaction = {
  id: string;
  airtable_record_id: string | null;
  trans_no: string | null;
  trans_seq: number | null;
  voucher_id: string | null;
  account_id: string | null;
  account_no: number | null;
  account_name: string | null;
  account_type: string | null;
  voucher_code: string | null;
  folio_ref: string | null;
  debit: number | null;
  credit: number | null;
  dr_qty: number | null;
  cr_qty: number | null;
  memo: string | null;
  ref1: string | null;
  ref2: string | null;
  accrue_date: string | null;
  cleared_date: string | null;
};

export type ARReportRow = {
  id: string;
  customer_code: string;
  customer_name: string;
  lot_no: string | null;
  r_no: string | null;
  misc_pas: string | null;
  po_no: string | null;
  inv_date: string | null;
  dep_no: string | null;
  dep_date: string | null;
  check1: string | null;
  check2: string | null;
  invoiced: number;
  invoice_credits: number;
  total_invoiced: number;
  unloading_fee: number;
  adjustments: number;
  amount_paid: number;
  balance_due: number;
  memo: string | null;
  division: string | null;
};

export type SyncRun = {
  id: string;
  direction: string;
  table_name: string | null;
  records_processed: number;
  records_failed: number;
  records_skipped: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export type AnomalyFlag = {
  id: string;
  table_name: string;
  record_id: string | null;
  flag_type: string;
  severity: string;
  description: string;
  resolved: boolean;
  created_at: string;
};
