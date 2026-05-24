/**
 * Airtable ↔ Postgres Bidirectional Sync Engine
 * MelonBook™ 2026 base: appmnU55C5f7A50U4
 */

import { query, queryOne, transaction } from '@/db';
import crypto from 'crypto';

export const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appmnU55C5f7A50U4';
export const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
export const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

// Table IDs
export const TABLE_IDS = {
  contacts:     'tblqy4XXa2ap3g66T',
  folios:       'tblxvWCSHdMKiOa56',
  vouchers:     'tblUYAd8KBsZi97Pu',
  transactions: 'tblfNYrQKvtOwslbr',
  accounts:     'tblmt7JoM80l0vO5I',
  items:        'tblOarNFTnDsSaO75',
  batches:      'tblIdxdCej9QvdirO',
  forms:        'tbl4vy605bt4KPDgA',
};

// AR-critical account numbers
export const AR_ACCOUNT_NOS = {
  ACCOUNTS_RECEIVABLE: 1152,  // Invoiced total
  UNDEPOSITED_FUNDS:   1122,  // Paid invoice total
  FREIGHT_COST:        1710,
  SALES_WATERMELONS:   1610,
  AP:                  1310,
};

// ============================================================
// AIRTABLE API CLIENT
// ============================================================
async function atFetch(path: string, opts: RequestInit = {}): Promise<unknown> {
  const url = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Exponential backoff retry
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  baseDelay = 500
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as Error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ============================================================
// PAGE THROUGH ALL RECORDS
// ============================================================
export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export async function* fetchAllRecords(
  tableId: string,
  fields?: string[],
  filterFormula?: string
): AsyncGenerator<AirtableRecord[]> {
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (fields?.length) fields.forEach(f => params.append('fields[]', f));
    if (filterFormula) params.set('filterByFormula', filterFormula);
    if (offset) params.set('offset', offset);

    const data = await withRetry(() =>
      atFetch(`${tableId}?${params}`) as Promise<{records: AirtableRecord[]; offset?: string}>
    );

    yield data.records;
    offset = data.offset;

    // Rate limit: 5 requests/sec
    if (offset) await new Promise(r => setTimeout(r, 210));
  } while (offset);
}

// ============================================================
// FIELD HASH (for change detection)
// ============================================================
export function computeFieldHash(fields: Record<string, unknown>): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(fields, Object.keys(fields).sort()))
    .digest('hex');
}

// ============================================================
// CONTACT SYNC
// ============================================================
export async function syncContacts(): Promise<{imported: number; updated: number; skipped: number}> {
  let imported = 0, updated = 0, skipped = 0;

  const fields = [
    'Code', 'Name', 'Type', 'Entity - Company Name',
    'Cust', 'Vndr', 'Frgt', '1stHd', 'Locat',
    'Address', 'City', 'State', 'Zip',
    'Phone 1', 'P1 Tlt', 'Phone 2', 'P2 Tlt',
    'eMail', 'Notes', 'A/R Limit', 'A/R Terms',
    'A/P Limit', 'A/P Terms', 'Modified',
  ];

  for await (const records of fetchAllRecords(TABLE_IDS.contacts, fields)) {
    for (const rec of records) {
      const f = rec.fields;
      const fieldHash = computeFieldHash(f);

      // Check existing
      const existing = await queryOne<{id: string; field_hash: string; postgres_updated_at: string; airtable_updated_at: string}>(
        'SELECT id, field_hash, postgres_updated_at, airtable_updated_at FROM contacts WHERE airtable_record_id = $1',
        [rec.id]
      );

      if (existing) {
        // Skip if unchanged
        if (existing.field_hash === fieldHash) { skipped++; continue; }

        // Conflict: both changed?
        const atUpdated = new Date(f['Modified'] as string || rec.createdTime);
        const pgUpdated = new Date(existing.postgres_updated_at);
        if (pgUpdated > atUpdated && existing.airtable_updated_at) {
          // Postgres is newer - keep postgres, log conflict
          await logConflict('contacts', existing.id, rec.id, existing, f, 'postgres', pgUpdated, atUpdated);
          skipped++;
          continue;
        }

        // Airtable wins - update postgres
        await query(`
          UPDATE contacts SET
            code = $2, name = $3, entity_company_name = $4, contact_type = $5,
            is_customer = $6, is_vendor = $7, is_freight = $8, is_first_handler = $9, is_location = $10,
            address = $11, city = $12, state = $13, zip = $14,
            phone1 = $15, phone1_title = $16, phone2 = $17, phone2_title = $18,
            email = $19, notes = $20, ar_limit = $21, ar_terms = $22,
            ap_limit = $23, ap_terms = $24,
            field_hash = $25, airtable_updated_at = $26, last_synced_at = NOW(),
            sync_origin = 'airtable', postgres_updated_at = NOW()
          WHERE id = $1
        `, [
          existing.id,
          f['Code'] || '', f['Name'] || '',
          f['Entity - Company Name'] || null, f['Type'] || null,
          !!f['Cust'], !!f['Vndr'], !!f['Frgt'], !!f['1stHd'], !!f['Locat'],
          f['Address'] || null, f['City'] || null, f['State'] || null, f['Zip'] || null,
          f['Phone 1'] || null, f['P1 Tlt'] || null, f['Phone 2'] || null, f['P2 Tlt'] || null,
          f['eMail'] || null, f['Notes'] || null,
          f['A/R Limit'] || null, f['A/R Terms'] || null,
          f['A/P Limit'] || null, f['A/P Terms'] || null,
          fieldHash, f['Modified'] ? new Date(f['Modified'] as string) : null,
        ]);
        updated++;
      } else {
        // New record
        await query(`
          INSERT INTO contacts (
            airtable_record_id, code, name, entity_company_name, contact_type,
            is_customer, is_vendor, is_freight, is_first_handler, is_location,
            address, city, state, zip, phone1, phone1_title, phone2, phone2_title,
            email, notes, ar_limit, ar_terms, ap_limit, ap_terms,
            field_hash, airtable_updated_at, last_synced_at, sync_origin
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW(),'airtable')
          ON CONFLICT (airtable_record_id) DO NOTHING
        `, [
          rec.id, f['Code'] || '', f['Name'] || '',
          f['Entity - Company Name'] || null, f['Type'] || null,
          !!f['Cust'], !!f['Vndr'], !!f['Frgt'], !!f['1stHd'], !!f['Locat'],
          f['Address'] || null, f['City'] || null, f['State'] || null, f['Zip'] || null,
          f['Phone 1'] || null, f['P1 Tlt'] || null, f['Phone 2'] || null, f['P2 Tlt'] || null,
          f['eMail'] || null, f['Notes'] || null,
          f['A/R Limit'] || null, f['A/R Terms'] || null,
          f['A/P Limit'] || null, f['A/P Terms'] || null,
          fieldHash, f['Modified'] ? new Date(f['Modified'] as string) : null,
        ]);
        imported++;
      }
    }
  }
  return { imported, updated, skipped };
}

// ============================================================
// ACCOUNTS SYNC
// ============================================================
export async function syncAccounts(): Promise<{imported: number; updated: number; skipped: number}> {
  let imported = 0, updated = 0, skipped = 0;

  for await (const records of fetchAllRecords(TABLE_IDS.accounts)) {
    for (const rec of records) {
      const f = rec.fields;
      const fieldHash = computeFieldHash(f);
      const existing = await queryOne<{id: string; field_hash: string}>(
        'SELECT id, field_hash FROM accounts WHERE airtable_record_id = $1', [rec.id]
      );

      if (existing) {
        if (existing.field_hash === fieldHash) { skipped++; continue; }
        await query(`
          UPDATE accounts SET
            acct_no = $2, title = $3, acct_type = $4, is_frequent = $5,
            field_hash = $6, last_synced_at = NOW(), sync_origin = 'airtable'
          WHERE id = $1
        `, [existing.id, f['No'] || 0, f['Title'] || '', f['Acct Type'] || null, !!f['Frequent'], fieldHash]);
        updated++;
      } else {
        await query(`
          INSERT INTO accounts (airtable_record_id, acct_no, title, acct_type, is_frequent, field_hash, last_synced_at, sync_origin)
          VALUES ($1,$2,$3,$4,$5,$6,NOW(),'airtable')
          ON CONFLICT (airtable_record_id) DO NOTHING
        `, [rec.id, f['No'] || 0, f['Title'] || '', f['Acct Type'] || null, !!f['Frequent'], fieldHash]);
        imported++;
      }
    }
  }
  return { imported, updated, skipped };
}

// ============================================================
// TRANSACTIONS SYNC (Most critical - AR data lives here)
// ============================================================
export async function syncTransactions(): Promise<{imported: number; updated: number; skipped: number}> {
  let imported = 0, updated = 0, skipped = 0;

  const fields = [
    'Trans #', 'ID', 'Vch Line', 'Acct Name', 'Memo',
    'Debit', 'Credit', 'Dr Qty', 'Cr Qty', 'Rate', '+Flat',
    'Ref 1', 'Ref 2', 'Status', 'Accrue', 'Cleared',
    'Folio', 'Via Free Entry', 'Via Resource',
  ];

  for await (const records of fetchAllRecords(TABLE_IDS.transactions, fields)) {
    for (const rec of records) {
      const f = rec.fields;
      const fieldHash = computeFieldHash(f);

      // Parse Trans# to extract account number: "DR1152-12345"
      const transNo = f['Trans #'] as string || '';
      const acctMatch = transNo.match(/^[A-Z]{2}(\d+)-/);
      const accountNo = acctMatch ? parseInt(acctMatch[1]) : null;

      // Look up voucher by linking (we store trans separately)
      const existing = await queryOne<{id: string; field_hash: string}>(
        'SELECT id, field_hash FROM transactions WHERE airtable_record_id = $1', [rec.id]
      );

      // Look up account
      const account = accountNo
        ? await queryOne<{id: string}>('SELECT id FROM accounts WHERE acct_no = $1 LIMIT 1', [accountNo])
        : null;

      // Extract folio ref
      const folioRef = Array.isArray(f['Folio'])
        ? (f['Folio'] as unknown[])[0]
        : null;

      // Accrue date
      const accrueArr = f['Accrue'];
      const accrueDate = Array.isArray(accrueArr) && accrueArr.length > 0
        ? accrueArr[0]
        : null;

      const row = [
        f['Trans #'] || null,
        f['ID'] || null,
        f['Vch Line'] || null,
        account?.id || null,
        accountNo,
        Array.isArray(f['Acct Name']) ? (f['Acct Name'] as string[])[0] : f['Acct Name'] || null,
        typeof folioRef === 'object' && folioRef !== null ? (folioRef as Record<string, string>).name : null,
        f['Memo'] || null,
        f['Debit'] || null,
        f['Credit'] || null,
        f['Dr Qty'] || null,
        f['Cr Qty'] || null,
        f['Rate'] || null,
        f['+Flat'] || null,
        Array.isArray(f['Ref 1']) ? (f['Ref 1'] as string[])[0] : f['Ref 1'] || null,
        Array.isArray(f['Ref 2']) ? (f['Ref 2'] as string[])[0] : f['Ref 2'] || null,
        Array.isArray(f['Status']) ? (f['Status'] as string[])[0] : f['Status'] || null,
        accrueDate,
        Array.isArray(f['Cleared']) ? (f['Cleared'] as string[])[0] : f['Cleared'] || null,
        Array.isArray(f['Via Free Entry']) ? (f['Via Free Entry'] as string[])[0] : null,
        fieldHash,
      ];

      if (existing) {
        if (existing.field_hash === fieldHash) { skipped++; continue; }
        await query(`
          UPDATE transactions SET
            trans_no=$2, trans_seq=$3, vch_line=$4, account_id=$5, account_no=$6,
            account_name=$7, folio_ref=$8, memo=$9, debit=$10, credit=$11,
            dr_qty=$12, cr_qty=$13, rate=$14, flat=$15, ref1=$16, ref2=$17,
            status=$18, accrue_date=$19, cleared_date=$20, via_free_entry=$21,
            field_hash=$22, last_synced_at=NOW(), sync_origin='airtable'
          WHERE id=$1
        `, [existing.id, ...row]);
        updated++;
      } else {
        await query(`
          INSERT INTO transactions (
            airtable_record_id, trans_no, trans_seq, vch_line, account_id, account_no,
            account_name, folio_ref, memo, debit, credit, dr_qty, cr_qty,
            rate, flat, ref1, ref2, status, accrue_date, cleared_date,
            via_free_entry, field_hash, last_synced_at, sync_origin
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),'airtable')
          ON CONFLICT (airtable_record_id) DO NOTHING
        `, [rec.id, ...row]);
        imported++;
      }
    }
  }
  return { imported, updated, skipped };
}

// ============================================================
// VOUCHERS SYNC (Invoice documents)
// ============================================================
export async function syncVouchers(): Promise<{imported: number; updated: number; skipped: number}> {
  let imported = 0, updated = 0, skipped = 0;

  const fields = [
    'Voucher', 'ID', 'Status', 'Reference 1', 'Reference 2',
    'CK#', 'Seal #', 'Tracking #', 'Via Free Entry',
    'Accrue', 'Placed', 'Perform On', 'Cleared',
    'Debit', 'Credit', 'Balance',
  ];

  for await (const records of fetchAllRecords(TABLE_IDS.vouchers, fields)) {
    for (const rec of records) {
      const f = rec.fields;
      const fieldHash = computeFieldHash(f);

      const existing = await queryOne<{id: string; field_hash: string}>(
        'SELECT id, field_hash FROM vouchers WHERE airtable_record_id = $1', [rec.id]
      );

      const accrueDate = f['Accrue'] ? new Date(f['Accrue'] as string) : null;
      const clearedDate = f['Cleared'] ? new Date(f['Cleared'] as string) : null;

      if (existing) {
        if (existing.field_hash === fieldHash) { skipped++; continue; }
        await query(`
          UPDATE vouchers SET
            voucher_code=$2, voucher_seq=$3, status=$4,
            reference1=$5, reference2=$6, ck_no=$7, seal_no=$8, tracking_no=$9,
            accrue_date=$10, placed_date=$11, cleared_date=$12,
            debit=$13, credit=$14, balance=$15,
            field_hash=$16, last_synced_at=NOW(), sync_origin='airtable'
          WHERE id=$1
        `, [
          existing.id,
          f['Voucher'] || null, f['ID'] || null, f['Status'] || null,
          f['Reference 1'] || null, f['Reference 2'] || null,
          f['CK#'] || null, f['Seal #'] || null, f['Tracking #'] || null,
          accrueDate, f['Placed'] ? new Date(f['Placed'] as string) : null, clearedDate,
          f['Debit'] || 0, f['Credit'] || 0, f['Balance'] || 0,
          fieldHash,
        ]);
        updated++;
      } else {
        await query(`
          INSERT INTO vouchers (
            airtable_record_id, voucher_code, voucher_seq, status,
            reference1, reference2, ck_no, seal_no, tracking_no,
            accrue_date, placed_date, cleared_date,
            debit, credit, balance,
            field_hash, last_synced_at, sync_origin
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),'airtable')
          ON CONFLICT (airtable_record_id) DO NOTHING
        `, [
          rec.id,
          f['Voucher'] || null, f['ID'] || null, f['Status'] || null,
          f['Reference 1'] || null, f['Reference 2'] || null,
          f['CK#'] || null, f['Seal #'] || null, f['Tracking #'] || null,
          accrueDate, f['Placed'] ? new Date(f['Placed'] as string) : null, clearedDate,
          f['Debit'] || 0, f['Credit'] || 0, f['Balance'] || 0,
          fieldHash,
        ]);
        imported++;
      }
    }
  }
  return { imported, updated, skipped };
}

// ============================================================
// CONFLICT LOGGING
// ============================================================
async function logConflict(
  tableName: string,
  recordId: string,
  airtableId: string,
  pgSnapshot: unknown,
  atSnapshot: unknown,
  winner: 'postgres' | 'airtable',
  pgUpdated: Date,
  atUpdated: Date
) {
  await query(`
    INSERT INTO conflict_audit (table_name, record_id, airtable_record_id, pg_snapshot, at_snapshot, pg_updated_at, at_updated_at, winner)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [tableName, recordId, airtableId, JSON.stringify(pgSnapshot), JSON.stringify(atSnapshot), pgUpdated, atUpdated, winner]);
}

// ============================================================
// OUTBOX PROCESSOR (Postgres → Airtable)
// ============================================================
export async function processOutbox(limit = 20): Promise<{processed: number; failed: number}> {
  let processed = 0, failed = 0;

  const rows = await query<{
    id: string; table_name: string; record_id: string;
    airtable_record_id: string; operation: string; payload: Record<string, unknown>;
  }>(`
    SELECT id, table_name, record_id, airtable_record_id, operation, payload
    FROM sync_outbox
    WHERE status = 'pending' AND next_attempt_at <= NOW()
    ORDER BY created_at ASC
    LIMIT $1
  `, [limit]);

  for (const row of rows) {
    try {
      // Mark as processing
      await query(`UPDATE sync_outbox SET status = 'processing', attempts = attempts + 1 WHERE id = $1`, [row.id]);

      const atFields = pgToAirtableFields(row.table_name, row.payload);

      if (row.operation === 'delete' && row.airtable_record_id) {
        await withRetry(() => atFetch(`${getTableId(row.table_name)}/${row.airtable_record_id}`, { method: 'DELETE' }));
      } else if (row.airtable_record_id && row.operation === 'update') {
        await withRetry(() => atFetch(`${getTableId(row.table_name)}/${row.airtable_record_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: atFields }),
        }));
      } else if (row.operation === 'insert') {
        const result = await withRetry(() => atFetch(getTableId(row.table_name), {
          method: 'POST',
          body: JSON.stringify({ fields: atFields }),
        })) as { id: string };
        // Update postgres with new airtable record ID
        await query(
          `UPDATE ${row.table_name} SET airtable_record_id = $1 WHERE id = $2`,
          [result.id, row.record_id]
        );
      }

      await query(`UPDATE sync_outbox SET status = 'done', processed_at = NOW() WHERE id = $1`, [row.id]);
      processed++;
    } catch (e) {
      const errMsg = (e as Error).message;
      const attempts = (await queryOne<{attempts: number}>('SELECT attempts FROM sync_outbox WHERE id = $1', [row.id]))?.attempts || 0;
      const nextAttempt = new Date(Date.now() + Math.pow(2, attempts) * 60000);

      await query(`
        UPDATE sync_outbox SET
          status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
          next_attempt_at = $2,
          error_message = $3
        WHERE id = $1
      `, [row.id, nextAttempt, errMsg]);
      failed++;
    }
  }
  return { processed, failed };
}

function getTableId(tableName: string): string {
  return TABLE_IDS[tableName as keyof typeof TABLE_IDS] || tableName;
}

// Map postgres fields back to Airtable format
function pgToAirtableFields(tableName: string, payload: Record<string, unknown>): Record<string, unknown> {
  if (tableName === 'contacts') {
    return {
      'Code': payload.code,
      'Name': payload.name,
      'Address': payload.address,
      'City': payload.city,
      'State': payload.state,
      'Zip': payload.zip,
      'Phone 1': payload.phone1,
      'eMail': payload.email,
      'Notes': payload.notes,
      'A/R Limit': payload.ar_limit,
      'A/R Terms': payload.ar_terms,
      'Cust': payload.is_customer,
      'Vndr': payload.is_vendor,
      'Frgt': payload.is_freight,
    };
  }
  return payload;
}

// ============================================================
// FULL SYNC ORCHESTRATOR
// ============================================================
export async function runFullSync(): Promise<Record<string, {imported: number; updated: number; skipped: number}>> {
  const results: Record<string, {imported: number; updated: number; skipped: number}> = {};

  // Log sync start
  const [run] = await query<{id: string}>(`
    INSERT INTO sync_runs (direction, table_name) VALUES ('at_to_pg', 'all') RETURNING id
  `);

  try {
    console.log('Syncing contacts...');
    results.contacts = await syncContacts();

    console.log('Syncing accounts...');
    results.accounts = await syncAccounts();

    console.log('Syncing vouchers...');
    results.vouchers = await syncVouchers();

    console.log('Syncing transactions...');
    results.transactions = await syncTransactions();

    const totalProcessed = Object.values(results).reduce((s, r) => s + r.imported + r.updated, 0);
    const totalSkipped = Object.values(results).reduce((s, r) => s + r.skipped, 0);

    await query(`
      UPDATE sync_runs SET completed_at = NOW(), records_processed = $2, records_skipped = $3
      WHERE id = $1
    `, [run.id, totalProcessed, totalSkipped]);
  } catch (e) {
    await query(`UPDATE sync_runs SET completed_at = NOW(), error_message = $2 WHERE id = $1`, [run.id, (e as Error).message]);
    throw e;
  }

  return results;
}

// ============================================================
// AR RECONCILIATION
// ============================================================
export async function reconcileAR(): Promise<{
  pgInvoiced: number;
  pgPaid: number;
  pgBalance: number;
  anomalies: Array<{type: string; description: string; severity: string}>;
}> {
  // AR totals from postgres (account 1152 debits = invoiced, account 1122 credits = paid)
  const [arRow] = await query<{invoiced: number; paid: number}>(`
    SELECT
      COALESCE(SUM(CASE WHEN account_no = 1152 THEN debit ELSE 0 END), 0) as invoiced,
      COALESCE(SUM(CASE WHEN account_no = 1122 THEN credit ELSE 0 END), 0) as paid
    FROM transactions
    WHERE deleted_at IS NULL
      AND account_no IN (1152, 1122)
  `);

  const pgInvoiced = Number(arRow?.invoiced || 0);
  const pgPaid = Number(arRow?.paid || 0);
  const pgBalance = pgInvoiced - pgPaid;

  const anomalies: Array<{type: string; description: string; severity: string}> = [];

  // Flag negative balances
  const negBal = await query<{customer_code: string; balance_due: number}>(
    `SELECT customer_code, SUM(balance_due) as balance_due
     FROM ar_report_cache
     GROUP BY customer_code
     HAVING SUM(balance_due) < -0.01`
  );
  for (const r of negBal) {
    anomalies.push({
      type: 'negative_balance',
      description: `${r.customer_code} has negative balance: $${r.balance_due.toFixed(2)}`,
      severity: 'error',
    });
  }

  // Flag amount_paid > total_invoiced
  const overpaid = await query<{customer_code: string; r_no: string; diff: number}>(`
    SELECT customer_code, r_no, (amount_paid - total_invoiced) as diff
    FROM ar_report_cache
    WHERE amount_paid > total_invoiced + 0.01
  `);
  for (const r of overpaid) {
    anomalies.push({
      type: 'overpayment',
      description: `${r.customer_code} R#${r.r_no}: paid $${r.diff.toFixed(2)} more than invoiced`,
      severity: 'warning',
    });
  }

  // Flag old unpaid balances (> 90 days)
  const old = await query<{customer_code: string; inv_date: string; balance_due: number}>(`
    SELECT customer_code, inv_date, balance_due
    FROM ar_report_cache
    WHERE balance_due > 0.01
      AND inv_date < NOW() - INTERVAL '90 days'
  `);
  for (const r of old) {
    anomalies.push({
      type: 'aged_balance',
      description: `${r.customer_code}: $${r.balance_due.toFixed(2)} balance due since ${r.inv_date}`,
      severity: 'warning',
    });
  }

  for (const anomaly of anomalies) {
    await query(`
      INSERT INTO anomaly_flags (table_name, flag_type, severity, description)
      SELECT 'vouchers', $1, $2, $3
      WHERE NOT EXISTS (
        SELECT 1 FROM anomaly_flags
        WHERE table_name = 'vouchers'
          AND flag_type = $1
          AND description = $3
          AND resolved = false
      )
    `, [anomaly.type, anomaly.severity, anomaly.description]);
  }

  return { pgInvoiced, pgPaid, pgBalance, anomalies };
}
