import { query, queryOne } from '@/db';

const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const AIRTABLE_META_URL = 'https://api.airtable.com/v0/meta';

export const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appmnU55C5f7A50U4';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
export const TRANSACTIONS_TABLE_ID = 'tblfNYrQKvtOwslbr';

export type AirtableTableInfo = {
  table_id: string;
  table_name: string;
  record_count: number;
  status: string;
  records_synced_at: string | null;
  schema_synced_at: string | null;
  sync_error: string | null;
};

type AirtableMetaTable = {
  id: string;
  name: string;
  description?: string;
  primaryFieldId?: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    options?: Record<string, unknown>;
  }>;
  views: Array<{
    id: string;
    name: string;
    type?: string;
  }>;
};

type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = {
  records: AirtableRecord[];
  offset?: string;
};

export type AirtableRecordFilter = {
  field: string;
  op: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'blank' | 'not_blank' | 'gt' | 'gte' | 'lt' | 'lte';
  value?: string;
};

function requireAirtableKey() {
  if (!AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_API_KEY is required for Airtable sync');
  }
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function airtableFetch<T>(url: string, init: RequestInit = {}, attempts = 5): Promise<T> {
  requireAirtableKey();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (response.ok) return response.json() as Promise<T>;

    const body = await response.text();
    lastError = new Error(`Airtable ${response.status}: ${body}`);

    if (response.status === 429 || response.status >= 500) {
      await sleep(500 * Math.pow(2, attempt));
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error('Airtable request failed');
}

function searchableText(fields: Record<string, unknown>): string {
  const parts: string[] = [];

  function visit(value: unknown) {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  }

  visit(fields);
  return parts.join(' ').slice(0, 20000);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function upsertAirtableRecordBatch(tableId: string, records: AirtableRecord[]) {
  if (records.length === 0) return 0;

  const payload = records.map(record => ({
    record_id: record.id,
    created_time: record.createdTime || null,
    raw_fields: record.fields || {},
    searchable_text: searchableText(record.fields || {}),
  }));

  await query(`
    INSERT INTO airtable_records (
      base_id, table_id, record_id, created_time, raw_fields,
      searchable_text, last_synced_at, sync_error
    )
    SELECT
      $1,
      $2,
      r.record_id,
      NULLIF(r.created_time, '')::timestamptz,
      r.raw_fields,
      r.searchable_text,
      NOW(),
      NULL
    FROM jsonb_to_recordset($3::jsonb) AS r(
      record_id TEXT,
      created_time TEXT,
      raw_fields JSONB,
      searchable_text TEXT
    )
    ON CONFLICT (table_id, record_id) DO UPDATE SET
      created_time = EXCLUDED.created_time,
      raw_fields = EXCLUDED.raw_fields,
      searchable_text = EXCLUDED.searchable_text,
      last_synced_at = NOW(),
      sync_error = NULL
  `, [
    AIRTABLE_BASE_ID,
    tableId,
    JSON.stringify(payload),
  ]);

  return records.length;
}

async function refreshAirtableMirrorCount(tableId: string) {
  const count = await queryOne<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM airtable_records WHERE table_id = $1',
    [tableId]
  );

  await query(`
    UPDATE airtable_sync_status
    SET record_count = $2,
        records_synced_at = NOW(),
        last_completed_at = NOW(),
        status = 'ok',
        sync_error = NULL,
        updated_at = NOW()
    WHERE table_id = $1
  `, [tableId, Number(count?.count || 0)]);
}

function appendRecordFilters(
  filters: AirtableRecordFilter[] | undefined,
  params: unknown[],
  whereParts: string[]
) {
  for (const filter of filters || []) {
    const field = filter.field?.trim();
    if (!field) continue;

    params.push(field);
    const fieldParam = `$${params.length}`;
    const fieldText = `COALESCE(raw_fields ->> ${fieldParam}, '')`;

    if (filter.op === 'blank') {
      whereParts.push(`${fieldText} = ''`);
      continue;
    }

    if (filter.op === 'not_blank') {
      whereParts.push(`${fieldText} <> ''`);
      continue;
    }

    const value = String(filter.value ?? '').trim();
    if (!value) continue;

    if (['gt', 'gte', 'lt', 'lte'].includes(filter.op)) {
      const parsed = Number(value.replace(/[$,]/g, ''));
      if (!Number.isFinite(parsed)) continue;

      params.push(parsed);
      const valueParam = `$${params.length}`;
      const numericField = `CASE WHEN ${fieldText} ~ '^-?[0-9,]+(\\.[0-9]+)?$' THEN REPLACE(${fieldText}, ',', '')::numeric ELSE NULL END`;
      const operator = filter.op === 'gt' ? '>' : filter.op === 'gte' ? '>=' : filter.op === 'lt' ? '<' : '<=';
      whereParts.push(`${numericField} ${operator} ${valueParam}`);
      continue;
    }

    params.push(filter.op.includes('contains') ? `%${value}%` : value);
    const valueParam = `$${params.length}`;

    if (filter.op === 'contains') {
      whereParts.push(`${fieldText} ILIKE ${valueParam}`);
    } else if (filter.op === 'not_contains') {
      whereParts.push(`${fieldText} NOT ILIKE ${valueParam}`);
    } else if (filter.op === 'equals') {
      whereParts.push(`LOWER(${fieldText}) = LOWER(${valueParam})`);
    } else if (filter.op === 'not_equals') {
      whereParts.push(`LOWER(${fieldText}) <> LOWER(${valueParam})`);
    }
  }
}

async function fetchMetadata(): Promise<AirtableMetaTable[]> {
  const data = await airtableFetch<{ tables: AirtableMetaTable[] }>(
    `${AIRTABLE_META_URL}/bases/${AIRTABLE_BASE_ID}/tables`
  );
  return data.tables;
}

export async function syncAirtableSchema() {
  const tables = await fetchMetadata();

  for (const table of tables) {
    await query(`
      INSERT INTO airtable_tables (
        base_id, table_id, table_name, primary_field_id, description, raw_schema,
        last_synced_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
      ON CONFLICT (table_id) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        primary_field_id = EXCLUDED.primary_field_id,
        description = EXCLUDED.description,
        raw_schema = EXCLUDED.raw_schema,
        last_synced_at = NOW(),
        updated_at = NOW()
    `, [
      AIRTABLE_BASE_ID,
      table.id,
      table.name,
      table.primaryFieldId || null,
      table.description || null,
      JSON.stringify(table),
    ]);

    for (const field of table.fields || []) {
      await query(`
        INSERT INTO airtable_fields (
          base_id, table_id, field_id, field_name, field_type, field_options,
          raw_schema, last_synced_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (table_id, field_id) DO UPDATE SET
          field_name = EXCLUDED.field_name,
          field_type = EXCLUDED.field_type,
          field_options = EXCLUDED.field_options,
          raw_schema = EXCLUDED.raw_schema,
          last_synced_at = NOW()
      `, [
        AIRTABLE_BASE_ID,
        table.id,
        field.id,
        field.name,
        field.type,
        JSON.stringify(field.options || {}),
        JSON.stringify(field),
      ]);
    }

    for (const view of table.views || []) {
      await query(`
        INSERT INTO airtable_views (
          base_id, table_id, view_id, view_name, view_type, raw_schema, last_synced_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        ON CONFLICT (table_id, view_id) DO UPDATE SET
          view_name = EXCLUDED.view_name,
          view_type = EXCLUDED.view_type,
          raw_schema = EXCLUDED.raw_schema,
          last_synced_at = NOW()
      `, [
        AIRTABLE_BASE_ID,
        table.id,
        view.id,
        view.name,
        view.type || null,
        JSON.stringify(view),
      ]);
    }

    await query(`
      INSERT INTO airtable_sync_status (
        base_id, table_id, table_name, schema_synced_at, status, updated_at
      )
      VALUES ($1,$2,$3,NOW(),'schema_synced',NOW())
      ON CONFLICT (table_id) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        schema_synced_at = NOW(),
        status = 'schema_synced',
        sync_error = NULL,
        updated_at = NOW()
    `, [AIRTABLE_BASE_ID, table.id, table.name]);
  }

  return { tables: tables.length };
}

export async function* fetchAirtableRecords(tableId: string, viewId?: string) {
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    if (viewId) params.set('view', viewId);

    const data = await airtableFetch<AirtableListResponse>(
      `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${tableId}?${params.toString()}`
    );
    yield data.records;
    offset = data.offset;
    if (offset) await sleep(225);
  } while (offset);
}

export async function syncAirtableTableRecords(tableId: string) {
  const table = await queryOne<{ table_name: string }>(
    'SELECT table_name FROM airtable_tables WHERE table_id = $1',
    [tableId]
  );
  const tableName = table?.table_name || tableId;
  const run = await queryOne<{ run_started_at: string }>('SELECT NOW()::text as run_started_at');
  const runStartedAt = run?.run_started_at || new Date().toISOString();

  await query(`
    INSERT INTO airtable_sync_status (
      base_id, table_id, table_name, last_started_at, status, updated_at
    )
    VALUES ($1,$2,$3,NOW(),'running',NOW())
    ON CONFLICT (table_id) DO UPDATE SET
      table_name = EXCLUDED.table_name,
      last_started_at = NOW(),
      status = 'running',
      sync_error = NULL,
      updated_at = NOW()
  `, [AIRTABLE_BASE_ID, tableId, tableName]);

  let count = 0;
  try {
    for await (const records of fetchAirtableRecords(tableId)) {
      count += await upsertAirtableRecordBatch(tableId, records);
    }

    await query(`
      DELETE FROM airtable_records
      WHERE table_id = $1
        AND last_synced_at < $2::timestamptz
    `, [tableId, runStartedAt]);

    await query(`
      UPDATE airtable_sync_status SET
        records_synced_at = NOW(),
        last_completed_at = NOW(),
        record_count = $2,
        status = 'ok',
        sync_error = NULL,
        updated_at = NOW()
      WHERE table_id = $1
    `, [tableId, count]);

    return { tableId, tableName, count };
  } catch (error) {
    await query(`
      UPDATE airtable_sync_status SET
        last_completed_at = NOW(),
        status = 'error',
        sync_error = $2,
        updated_at = NOW()
      WHERE table_id = $1
    `, [tableId, (error as Error).message]);
    throw error;
  }
}

export async function syncAccountingViewStats() {
  const views = await query<{ table_id: string; view_id: string; view_name: string }>(`
    SELECT table_id, view_id, view_name
    FROM airtable_views
    WHERE table_id = $1
      AND view_name ILIKE 'ACCTG%'
  `, [TRANSACTIONS_TABLE_ID]);

  const results = [];

  for (const view of views) {
    let recordCount = 0;
    let debitTotal = 0;
    let creditTotal = 0;
    let error: string | null = null;

    try {
      for await (const records of fetchAirtableRecords(view.table_id, view.view_id)) {
        for (const record of records) {
          recordCount++;
          debitTotal += asNumber(record.fields.Debit);
          creditTotal += asNumber(record.fields.Credit);
        }
      }
    } catch (e) {
      error = (e as Error).message;
    }

    await query(`
      INSERT INTO airtable_view_stats (
        base_id, table_id, view_id, view_name, record_count, debit_total,
        credit_total, last_synced_at, sync_error
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8)
      ON CONFLICT (table_id, view_id) DO UPDATE SET
        view_name = EXCLUDED.view_name,
        record_count = EXCLUDED.record_count,
        debit_total = EXCLUDED.debit_total,
        credit_total = EXCLUDED.credit_total,
        last_synced_at = NOW(),
        sync_error = EXCLUDED.sync_error
    `, [
      AIRTABLE_BASE_ID,
      view.table_id,
      view.view_id,
      view.view_name,
      recordCount,
      debitTotal,
      creditTotal,
      error,
    ]);

    results.push({ ...view, recordCount, debitTotal, creditTotal, error });
  }

  return results;
}

export async function syncAllAirtableRecords() {
  const schema = await syncAirtableSchema();
  const tables = await query<{ table_id: string; table_name: string }>(
    'SELECT table_id, table_name FROM airtable_tables ORDER BY table_name'
  );

  const results = [];
  for (const table of tables) {
    results.push(await syncAirtableTableRecords(table.table_id));
  }

  const viewStats = await syncAccountingViewStats();
  return { schema, tables: results, viewStats };
}

export async function getAirtableTables(): Promise<AirtableTableInfo[]> {
  return query<AirtableTableInfo>(`
    SELECT
      t.table_id,
      t.table_name,
      COALESCE(s.record_count, 0) as record_count,
      COALESCE(s.status, 'pending') as status,
      s.records_synced_at,
      s.schema_synced_at,
      s.sync_error
    FROM airtable_tables t
    LEFT JOIN airtable_sync_status s ON s.table_id = t.table_id
    ORDER BY t.table_name
  `);
}

export async function getAirtableRecords(options: {
  tableId: string;
  search?: string;
  filters?: AirtableRecordFilter[];
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(options.page || 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize || 50, 1), 100);
  const offset = (page - 1) * pageSize;
  const search = options.search?.trim();
  const params: unknown[] = [options.tableId];
  let where = 'WHERE table_id = $1';
  const whereParts: string[] = [];

  if (search) {
    params.push(`%${search}%`);
    whereParts.push(`searchable_text ILIKE $${params.length}`);
  }

  appendRecordFilters(options.filters, params, whereParts);

  if (whereParts.length > 0) {
    where += ` AND ${whereParts.join(' AND ')}`;
  }

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM airtable_records ${where}`,
    params
  );
  params.push(pageSize, offset);
  const records = await query<{
    record_id: string;
    created_time: string | null;
    raw_fields: Record<string, unknown>;
    last_synced_at: string;
  }>(`
    SELECT record_id, created_time::text as created_time, raw_fields, last_synced_at::text as last_synced_at
    FROM airtable_records
    ${where}
    ORDER BY created_time DESC NULLS LAST, record_id
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return {
    records,
    page,
    pageSize,
    total: Number(countRows[0]?.count || 0),
  };
}

export async function createAirtableRecord(tableId: string, fields: Record<string, unknown>) {
  const result = await airtableFetch<{ records: AirtableRecord[] }>(
    `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${tableId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true,
      }),
    }
  );

  const record = result.records[0];
  if (!record) throw new Error('Airtable did not return the created record');

  await upsertAirtableRecordBatch(tableId, [record]);
  await refreshAirtableMirrorCount(tableId);
  return record;
}

export async function updateAirtableRecord(tableId: string, recordId: string, fields: Record<string, unknown>) {
  const result = await airtableFetch<{ records: AirtableRecord[] }>(
    `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${tableId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        records: [{ id: recordId, fields }],
        typecast: true,
      }),
    }
  );

  const record = result.records[0];
  if (!record) throw new Error('Airtable did not return the updated record');

  await upsertAirtableRecordBatch(tableId, [record]);
  await refreshAirtableMirrorCount(tableId);
  return record;
}

export async function deleteAirtableRecord(tableId: string, recordId: string) {
  const result = await airtableFetch<{ deleted: boolean; id: string }>(
    `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
    { method: 'DELETE' }
  );

  await query('DELETE FROM airtable_records WHERE table_id = $1 AND record_id = $2', [tableId, recordId]);
  await refreshAirtableMirrorCount(tableId);
  return result;
}

export async function getAirtableSyncStatus() {
  const tables = await getAirtableTables();
  const viewStats = await query<{
    table_id: string;
    view_id: string;
    view_name: string;
    record_count: number;
    debit_total: number;
    credit_total: number;
    last_synced_at: string;
    sync_error: string | null;
  }>('SELECT * FROM airtable_view_stats ORDER BY view_name');
  return { tables, viewStats };
}
