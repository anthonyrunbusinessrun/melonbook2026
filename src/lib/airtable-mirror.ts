/**
 * Airtable Mirror Sync — Raw record sync for all 9 tables
 * Stores every record's raw JSON into airtable_records table
 */

import { query } from '@/db';
import { fetchAllRecords, AIRTABLE_BASE_ID, AIRTABLE_API_KEY } from './sync';

export const ALL_TABLES = [
  { id: 'tblfNYrQKvtOwslbr', name: 'Transactions' },
  { id: 'tblqy4XXa2ap3g66T', name: 'Contacts' },
  { id: 'tblxvWCSHdMKiOa56', name: 'Folios' },
  { id: 'tblUYAd8KBsZi97Pu', name: 'Vouchers' },
  { id: 'tblmt7JoM80l0vO5I', name: 'Accounts' },
  { id: 'tblIdxdCej9QvdirO', name: 'Batches' },
  { id: 'tblOarNFTnDsSaO75', name: 'Items' },
  { id: 'tbllwqsWIRSTKIVFf', name: 'Attachments' },
  { id: 'tbl4vy605bt4KPDgA', name: 'Forms' },
];

async function metaFetch(url: string): Promise<unknown> {
  let attempt = 0;
  while (attempt < 5) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 30000 + attempt * 5000));
      attempt++;
      continue;
    }
    if (!res.ok) {
      throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error('Max retries exceeded');
}

export async function syncSchema() {
  const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const data = await metaFetch(metaUrl) as { tables: Array<{id: string; name: string; fields: unknown[]; views: unknown[]}> };
  
  for (const table of (data.tables || [])) {
    await query(
      `INSERT INTO airtable_schema_cache (base_id, table_id, table_name, fields, views, cached_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (base_id, table_id) DO UPDATE SET
         table_name = EXCLUDED.table_name, fields = EXCLUDED.fields,
         views = EXCLUDED.views, cached_at = NOW()`,
      [AIRTABLE_BASE_ID, table.id, table.name, JSON.stringify(table.fields || []), JSON.stringify(table.views || [])]
    );
  }
  return data.tables?.length || 0;
}

export async function syncTableRecords(tableId: string, tableName: string): Promise<{ synced: number; errors: number }> {
  await query(
    `INSERT INTO airtable_sync_status (table_id, table_name, status, sync_started_at)
     VALUES ($1, $2, 'running', NOW())
     ON CONFLICT (table_id) DO UPDATE SET status = 'running', sync_started_at = NOW(), error_message = NULL`,
    [tableId, tableName]
  );

  let synced = 0;
  let errors = 0;
  const startMs = Date.now();

  try {
    for await (const batch of fetchAllRecords(tableId)) {
      if (batch.length === 0) continue;
      
      const CHUNK = 50;
      for (let i = 0; i < batch.length; i += CHUNK) {
        const chunk = batch.slice(i, i + CHUNK);
        try {
          const values: unknown[] = [];
          const placeholders: string[] = [];
          chunk.forEach((rec, idx) => {
            const base = idx * 5;
            placeholders.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})`);
            values.push(tableId, tableName, rec.id, rec.createdTime, JSON.stringify(rec.fields));
          });
          await query(
            `INSERT INTO airtable_records (table_id, table_name, airtable_record_id, created_time, raw_fields, last_synced_at)
             VALUES ${placeholders.join(',')}
             ON CONFLICT (table_id, airtable_record_id) DO UPDATE SET
               raw_fields = EXCLUDED.raw_fields, last_synced_at = NOW(), sync_error = NULL`,
            values
          );
          synced += chunk.length;
        } catch (e) {
          errors += chunk.length;
          console.error(`Chunk error in ${tableName}:`, e);
        }
      }
      await new Promise(r => setTimeout(r, 250));
    }

    const countRows = await query<{count: string}>(
      `SELECT COUNT(*) as count FROM airtable_records WHERE table_id = $1`, [tableId]
    );
    const mirroredCount = parseInt(countRows[0]?.count || '0');

    await query(
      `UPDATE airtable_sync_status SET
         status = 'done', mirrored_count = $2, last_synced_at = NOW(),
         duration_ms = $3, error_message = NULL
       WHERE table_id = $1`,
      [tableId, mirroredCount, Date.now() - startMs]
    );
  } catch (e) {
    const msg = (e as Error).message;
    await query(
      `UPDATE airtable_sync_status SET status = 'error', error_message = $2, duration_ms = $3
       WHERE table_id = $1`,
      [tableId, msg, Date.now() - startMs]
    );
    throw e;
  }

  return { synced, errors };
}

export async function syncAllTables(tableIds?: string[]) {
  const tables = tableIds
    ? ALL_TABLES.filter(t => tableIds.includes(t.id))
    : ALL_TABLES;
  
  const results: Record<string, { synced: number; errors: number }> = {};
  for (const table of tables) {
    try {
      console.log(`Syncing ${table.name}...`);
      results[table.name] = await syncTableRecords(table.id, table.name);
      console.log(`${table.name}: ${results[table.name].synced} synced`);
    } catch (e) {
      console.error(`Failed syncing ${table.name}:`, e);
      results[table.name] = { synced: 0, errors: 1 };
    }
  }
  return results;
}

export async function getSyncStatus() {
  return query<{
    table_id: string; table_name: string; airtable_count: number | null;
    mirrored_count: number | null; last_synced_at: string | null;
    sync_started_at: string | null;
    status: string; error_message: string | null; duration_ms: number | null;
  }>(`SELECT * FROM airtable_sync_status ORDER BY table_name`);
}

export async function getTableRecords(
  tableId: string,
  page = 1,
  pageSize = 50,
  search?: string
) {
  const offset = (page - 1) * pageSize;

  const safeSearch = search?.trim();
  const searchClause = safeSearch ? `AND raw_fields::text ILIKE $4` : '';
  const baseParams: unknown[] = [tableId, pageSize, offset];
  if (safeSearch) baseParams.push(`%${safeSearch}%`);

  const [rows, countRows] = await Promise.all([
    query<{
      airtable_record_id: string;
      created_time: string;
      raw_fields: Record<string, unknown>;
      last_synced_at: string;
    }>(
      `SELECT airtable_record_id, created_time, raw_fields, last_synced_at
       FROM airtable_records
       WHERE table_id = $1 ${searchClause}
       ORDER BY created_time DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      baseParams
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM airtable_records WHERE table_id = $1 ${searchClause}`,
      safeSearch ? [tableId, `%${safeSearch}%`] : [tableId]
    ),
  ]);

  return {
    records: rows,
    total: parseInt(countRows[0]?.count || '0'),
    page,
    pageSize,
  };
}

export async function getSchemaForTable(tableId: string) {
  const rows = await query<{
    fields: unknown;
    views: unknown;
    table_name: string;
    cached_at: string;
  }>(
    `SELECT fields, views, table_name, cached_at FROM airtable_schema_cache WHERE table_id = $1`,
    [tableId]
  );
  return rows[0] || null;
}

export async function getARViewData() {
  // Get AR 1152 (Invoiced) and 1122 (Paid) from mirror
  const [inv1152, paid1122] = await Promise.all([
    query<{ count: string; total: string }>(
      `SELECT COUNT(*) as count, COALESCE(SUM((raw_fields->>'Debit')::numeric), 0)::text as total
       FROM airtable_records
       WHERE table_id = 'tblfNYrQKvtOwslbr'
         AND raw_fields->>'Trans #' LIKE 'DR1152%'`
    ),
    query<{ count: string; total: string }>(
      `SELECT COUNT(*) as count, COALESCE(SUM((raw_fields->>'Credit')::numeric), 0)::text as total
       FROM airtable_records
       WHERE table_id = 'tblfNYrQKvtOwslbr'
         AND raw_fields->>'Trans #' LIKE 'CR1122%'`
    ),
  ]);
  
  return {
    acct1152: {
      count: parseInt(inv1152[0]?.count || '0'),
      total: parseFloat(inv1152[0]?.total || '0'),
      description: 'Accounts Receivable (Invoiced)',
    },
    acct1122: {
      count: parseInt(paid1122[0]?.count || '0'),
      total: parseFloat(paid1122[0]?.total || '0'),
      description: 'Undeposited Funds (Paid)',
    },
  };
}
