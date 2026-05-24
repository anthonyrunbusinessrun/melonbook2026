export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Database, RefreshCw, Search, Table2 } from 'lucide-react';
import { query } from '@/db';
import {
  getAirtableRecords,
  getAirtableTables,
  syncAirtableSchema,
  type AirtableTableInfo,
} from '@/lib/airtable-mirror';

type FieldInfo = {
  field_name: string;
  field_type: string;
};

function fmtDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatValue(value: unknown) {
  if (value == null || value === '') return <span className="text-brand-warm/30">—</span>;
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-brand-warm/30">—</span>;
    return value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ');
  }
  return JSON.stringify(value);
}

function buildHref(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return `/data-explorer?${search.toString()}`;
}

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

  const selectedTableId = sp.table || tables[0]?.table_id;
  const selectedTable = tables.find(table => table.table_id === selectedTableId);
  const page = Math.max(Number(sp.page || 1), 1);
  const q = sp.q || '';

  const fields = selectedTableId
    ? await query<FieldInfo>(`
        SELECT field_name, field_type
        FROM airtable_fields
        WHERE table_id = $1
        ORDER BY field_name
      `, [selectedTableId])
    : [];

  const data = selectedTableId
    ? await getAirtableRecords({ tableId: selectedTableId, search: q, page, pageSize: 50 })
    : { records: [], page: 1, pageSize: 50, total: 0 };

  const firstRecordFields = Object.keys(data.records[0]?.raw_fields || {});
  const preferredColumns = [
    'Name', 'Trans #', 'Date', 'Accrue Date', 'Account', 'Account Name',
    'Debit', 'Credit', 'Balance', 'Customer', 'Issued Contact', 'Lot #',
    'R #', 'PO #', 'Memo', 'Status',
  ];
  const allFieldNames = fields.map(field => field.field_name);
  const columns = [
    ...preferredColumns.filter(name => allFieldNames.includes(name) || firstRecordFields.includes(name)),
    ...allFieldNames.filter(name => !preferredColumns.includes(name)),
    ...firstRecordFields.filter(name => !preferredColumns.includes(name) && !allFieldNames.includes(name)),
  ].slice(0, 14);

  const totalPages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  const syncedCount = tables.reduce((sum, table) => sum + Number(table.record_count || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Airtable Data Explorer</h1>
          <p className="text-brand-sage/60 text-sm">
            Live mirror of MelonBook 2026 tables, fields, views, and records in Railway Postgres.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sync" className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} />
            Sync Center
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-brand-cream font-semibold text-sm">
              <Database size={16} className="text-brand-sage" />
              Base Snapshot
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div>
                <div className="label text-[10px]">Tables</div>
                <div className="text-brand-cream font-semibold text-lg">{tables.length}</div>
              </div>
              <div>
                <div className="label text-[10px]">Records</div>
                <div className="text-brand-cream font-semibold text-lg">{syncedCount.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-green/20 text-xs font-semibold text-brand-sage uppercase tracking-wider">
              Airtable Tables
            </div>
            <div className="max-h-[calc(100vh-270px)] overflow-y-auto p-2 space-y-1">
              {tables.map(table => {
                const active = table.table_id === selectedTableId;
                return (
                  <Link
                    key={table.table_id}
                    href={buildHref({ table: table.table_id })}
                    className={`block rounded px-3 py-2 border transition-colors ${
                      active
                        ? 'border-brand-sage/40 bg-brand-green/30'
                        : 'border-transparent hover:bg-brand-green/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-brand-cream truncate">{table.table_name}</span>
                      <span className="text-[10px] text-brand-warm/50 font-mono">
                        {Number(table.record_count || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className={table.status === 'ok' ? 'text-brand-sage' : 'text-brand-gold'}>
                        {table.status}
                      </span>
                      <span className="text-brand-warm/40">{fmtDate(table.records_synced_at || table.schema_synced_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-4 min-w-0">
          <div className="card p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Table2 size={16} className="text-brand-sage" />
                  <h2 className="text-lg font-semibold text-brand-cream">{selectedTable?.table_name || 'No table selected'}</h2>
                </div>
                <p className="text-xs text-brand-warm/50 mt-1">
                  {selectedTableId || 'Run schema sync to load Airtable tables.'}
                </p>
              </div>
              <div className="text-right text-xs text-brand-warm/50">
                <div>{data.total.toLocaleString()} matching records</div>
                <div>{fields.length.toLocaleString()} fields</div>
              </div>
            </div>

            {selectedTableId && (
              <form method="GET" className="mt-4 flex items-center gap-2">
                <input type="hidden" name="table" value={selectedTableId} />
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-brand-sage/50" />
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Search every synced field in this table..."
                    className="input pl-9 h-9"
                  />
                </div>
                <button type="submit" className="btn-primary h-9">Search</button>
                {q && <Link href={buildHref({ table: selectedTableId })} className="btn-secondary h-9">Clear</Link>}
              </form>
            )}
          </div>

          {data.records.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-brand-cream font-medium">No synced records yet</div>
              <div className="text-sm text-brand-sage/50 mt-1">
                Open Sync Center and run Full Airtable Mirror Sync to pull every table into Postgres.
              </div>
              <Link href="/sync" className="btn-gold inline-flex mt-4">Go to Sync Center</Link>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="ops-table min-w-full">
                  <thead>
                    <tr>
                      <th className="min-w-36">Record ID</th>
                      {columns.map(column => (
                        <th key={column} className="min-w-32">{column}</th>
                      ))}
                      <th className="min-w-28">Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map(record => (
                      <tr key={record.record_id} className="table-row-hover align-top">
                        <td className="font-mono text-brand-sage/70">
                          <details>
                            <summary className="cursor-pointer">{record.record_id}</summary>
                            <pre className="mt-2 max-w-xl overflow-auto rounded bg-brand-dark p-3 text-[10px] text-brand-warm/70">
                              {JSON.stringify(record.raw_fields, null, 2)}
                            </pre>
                          </details>
                        </td>
                        {columns.map(column => (
                          <td key={`${record.record_id}-${column}`} className="max-w-64 truncate" title={String(formatValue(record.raw_fields[column]) || '')}>
                            {formatValue(record.raw_fields[column])}
                          </td>
                        ))}
                        <td className="text-brand-warm/50">{fmtDate(record.last_synced_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-brand-green/20 px-4 py-3 text-xs">
                <div className="text-brand-warm/50">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildHref({ table: selectedTableId, q, page: Math.max(page - 1, 1) })}
                    className={`btn-secondary text-xs py-1.5 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                  >
                    Previous
                  </Link>
                  <Link
                    href={buildHref({ table: selectedTableId, q, page: Math.min(page + 1, totalPages) })}
                    className={`btn-secondary text-xs py-1.5 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
