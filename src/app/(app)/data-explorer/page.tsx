export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { query } from '@/db';
import {
  getAirtableRecords,
  getAirtableTables,
  syncAirtableSchema,
  type AirtableTableInfo,
} from '@/lib/airtable-mirror';
import { AirtableGrid, type GridField, type GridView } from './AirtableGrid';

export default async function DataExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams;
  let tables: AirtableTableInfo[] = await getAirtableTables();

  if (tables.length === 0) {
    try {
      await syncAirtableSchema();
      tables = await getAirtableTables();
    } catch {
      // The Sync Center will surface the exact connection error.
    }
  }

  const selectedTableId = sp.table || tables[0]?.table_id || '';
  const selectedTable = tables.find(table => table.table_id === selectedTableId);
  const page = Math.max(Number(sp.page || 1), 1);
  const q = sp.q || '';

  const [schemaFields, views] = selectedTableId
    ? await Promise.all([
        query<GridField>(`
          SELECT
            field.value->>'id' as field_id,
            field.value->>'name' as field_name,
            field.value->>'type' as field_type,
            COALESCE(field.value->'options', '{}'::jsonb) as field_options,
            field.ordinality::int as field_order
          FROM airtable_tables t
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.raw_schema->'fields', '[]'::jsonb))
            WITH ORDINALITY AS field(value, ordinality)
          WHERE t.table_id = $1
          ORDER BY field.ordinality
        `, [selectedTableId]),
        query<GridView>(`
          SELECT view_id, view_name, view_type
          FROM airtable_views
          WHERE table_id = $1
          ORDER BY view_name
        `, [selectedTableId]),
      ])
    : [[], []];

  const fields = schemaFields.length > 0
    ? schemaFields
    : selectedTableId
      ? await query<GridField>(`
          SELECT
            field_id,
            field_name,
            field_type,
            field_options,
            row_number() OVER (ORDER BY field_name)::int as field_order
          FROM airtable_fields
          WHERE table_id = $1
          ORDER BY field_name
        `, [selectedTableId])
      : [];

  const data = selectedTableId
    ? await getAirtableRecords({ tableId: selectedTableId, search: q, page, pageSize: 50 })
    : { records: [], page: 1, pageSize: 50, total: 0 };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Airtable Grid</h1>
          <p className="text-brand-sage/60 text-sm">
            Airtable-style table views for every MelonBook 2026 database, synced through Railway Postgres.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sync" className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} />
            Sync Center
          </Link>
        </div>
      </div>

      {selectedTableId ? (
        <AirtableGrid
          tables={tables}
          selectedTableId={selectedTableId}
          selectedTableName={selectedTable?.table_name || selectedTableId}
          fields={fields}
          views={views}
          initialRecords={data.records}
          initialPage={data.page}
          initialPageSize={data.pageSize}
          initialTotal={data.total}
          initialSearch={q}
        />
      ) : (
        <div className="card p-10 text-center">
          <div className="text-brand-cream font-medium">No Airtable schema loaded yet</div>
          <div className="text-sm text-brand-sage/50 mt-1">Run a schema sync from Sync Center to load tables and fields.</div>
          <Link href="/sync" className="btn-gold inline-flex mt-4">Go to Sync Center</Link>
        </div>
      )}
    </div>
  );
}
