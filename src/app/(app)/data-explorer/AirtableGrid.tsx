'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Edit3,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';

export type GridTable = {
  table_id: string;
  table_name: string;
  record_count: number;
  status: string;
  records_synced_at: string | null;
  schema_synced_at: string | null;
  sync_error: string | null;
};

export type GridField = {
  field_id: string;
  field_name: string;
  field_type: string;
  field_options?: Record<string, unknown> | null;
  field_order: number;
};

export type GridView = {
  view_id: string;
  view_name: string;
  view_type: string | null;
};

export type GridRecord = {
  record_id: string;
  created_time: string | null;
  raw_fields: Record<string, unknown>;
  last_synced_at: string;
};

type FilterRow = {
  id: string;
  field: string;
  op: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'blank' | 'not_blank' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string;
};

type RecordsPayload = {
  records: GridRecord[];
  page: number;
  pageSize: number;
  total: number;
};

const operators = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'blank', label: 'is empty' },
  { value: 'not_blank', label: 'is not empty' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
] as const;

const editableTypes = new Set([
  'singleLineText',
  'multilineText',
  'richText',
  'email',
  'url',
  'phoneNumber',
  'number',
  'currency',
  'percent',
  'duration',
  'rating',
  'checkbox',
  'singleSelect',
  'multipleSelects',
  'date',
  'dateTime',
]);

function formatDate(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function plainValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plainValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.name || object.email || object.id || JSON.stringify(object));
  }
  return String(value);
}

function cellValue(value: unknown) {
  const text = plainValue(value);
  return text || '—';
}

function fieldChoices(field: GridField) {
  const choices = (field.field_options?.choices || []) as Array<{ name?: string }>;
  return choices.map(choice => choice.name).filter(Boolean) as string[];
}

function initialInputValue(field: GridField, value: unknown) {
  if (value == null) return '';
  if (field.field_type === 'multipleSelects' && Array.isArray(value)) return value.map(plainValue).join(', ');
  if (field.field_type === 'checkbox') return value ? 'true' : 'false';
  if (field.field_type === 'date' || field.field_type === 'dateTime') return String(value).slice(0, field.field_type === 'date' ? 10 : 16);
  return plainValue(value);
}

function serializeFieldValue(field: GridField, value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (['number', 'currency', 'percent', 'duration', 'rating'].includes(field.field_type)) {
    const parsed = Number(trimmed.replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (field.field_type === 'checkbox') return value === 'true';
  if (field.field_type === 'multipleSelects') return trimmed.split(',').map(item => item.trim()).filter(Boolean);
  return trimmed;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

function newFilter(field: string): FilterRow {
  return {
    id: Math.random().toString(36).slice(2),
    field,
    op: 'contains',
    value: '',
  };
}

export function AirtableGrid({
  tables,
  selectedTableId,
  selectedTableName,
  fields,
  views,
  initialRecords,
  initialPage,
  initialPageSize,
  initialTotal,
  initialSearch,
}: {
  tables: GridTable[];
  selectedTableId: string;
  selectedTableName: string;
  fields: GridField[];
  views: GridView[];
  initialRecords: GridRecord[];
  initialPage: number;
  initialPageSize: number;
  initialTotal: number;
  initialSearch: string;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; record?: GridRecord } | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const allFieldNames = useMemo(() => fields.map(field => field.field_name), [fields]);
  const columns = useMemo(() => {
    const firstRecordFields = Object.keys(records[0]?.raw_fields || {});
    return [...allFieldNames, ...firstRecordFields.filter(name => !allFieldNames.includes(name))];
  }, [allFieldNames, records]);

  const editableFields = useMemo(
    () => fields.filter(field => editableTypes.has(field.field_type)),
    [fields]
  );
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function loadRecords(nextPage = page, nextSearch = search, nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const activeFilters = nextFilters
        .filter(filter => filter.field && (filter.op === 'blank' || filter.op === 'not_blank' || filter.value.trim()))
        .map(({ field, op, value }) => ({ field, op, value }));
      const query = buildQuery({
        q: nextSearch,
        page: nextPage,
        pageSize,
        filters: activeFilters.length ? JSON.stringify(activeFilters) : undefined,
      });
      const response = await fetch(`/api/airtable/tables/${selectedTableId}/records?${query}`, { cache: 'no-store' });
      const data: RecordsPayload & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load records');
      setRecords(data.records || []);
      setPage(data.page || nextPage);
      setTotal(data.total || 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    const values: Record<string, string> = {};
    editableFields.forEach(field => {
      values[field.field_name] = '';
    });
    setFormValues(values);
    setModal({ mode: 'create' });
  }

  function openEdit(record: GridRecord) {
    const values: Record<string, string> = {};
    editableFields.forEach(field => {
      values[field.field_name] = initialInputValue(field, record.raw_fields[field.field_name]);
    });
    setFormValues(values);
    setModal({ mode: 'edit', record });
  }

  async function saveRecord() {
    if (!modal) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      editableFields.forEach(field => {
        payload[field.field_name] = serializeFieldValue(field, formValues[field.field_name] || '');
      });

      const path = modal.mode === 'create'
        ? `/api/airtable/tables/${selectedTableId}/records`
        : `/api/airtable/tables/${selectedTableId}/records/${modal.record?.record_id}`;
      const response = await fetch(path, {
        method: modal.mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save record');

      setModal(null);
      setMessage(modal.mode === 'create' ? 'Record created in Airtable and synced to Postgres.' : 'Record updated in Airtable and synced to Postgres.');
      await loadRecords(modal.mode === 'create' ? 1 : page);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record: GridRecord) {
    if (!confirm(`Delete ${record.record_id} from Airtable? This also removes it from the PostgreSQL mirror.`)) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/airtable/tables/${selectedTableId}/records/${record.record_id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete record');
      setMessage('Record deleted from Airtable and PostgreSQL mirror.');
      await loadRecords(page);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(id: string, patch: Partial<FilterRow>) {
    setFilters(prev => prev.map(filter => filter.id === id ? { ...filter, ...patch } : filter));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
      <aside className="space-y-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-brand-cream font-semibold text-sm">Base Snapshot</div>
            <span className="badge-green">{tables.length} tables</span>
          </div>
          <div className="text-xs text-brand-sage/55 mt-2">
            {tables.reduce((sum, table) => sum + Number(table.record_count || 0), 0).toLocaleString()} synced records
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
                <a
                  key={table.table_id}
                  href={`/data-explorer?table=${table.table_id}`}
                  className={`block rounded px-3 py-2 border transition-colors ${
                    active ? 'border-brand-sage/40 bg-brand-green/30' : 'border-transparent hover:bg-brand-green/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-brand-cream truncate">{table.table_name}</span>
                    <span className="text-[10px] text-brand-warm/50 font-mono">
                      {Number(table.record_count || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                    <span className={table.status === 'ok' ? 'text-brand-sage' : 'text-brand-gold'}>{table.status}</span>
                    <span className="text-brand-warm/40">{formatDate(table.records_synced_at || table.schema_synced_at)}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="space-y-4 min-w-0">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-brand-cream truncate">{selectedTableName}</h2>
              <p className="text-xs text-brand-warm/50 mt-1">{selectedTableId}</p>
              {views.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                  {views.map(view => (
                    <span key={view.view_id} className="badge-gray whitespace-nowrap">
                      {view.view_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-brand-warm/50">
              <div>{total.toLocaleString()} matching records</div>
              <div>{fields.length.toLocaleString()} Airtable fields</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-72">
              <Search size={14} className="absolute left-3 top-2.5 text-brand-sage/50" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') loadRecords(1);
                }}
                placeholder="Search every synced field in this table..."
                className="input pl-9 h-9"
              />
            </div>
            <button onClick={() => loadRecords(1)} className="btn-primary h-9 inline-flex items-center gap-1.5">
              <Search size={13} /> Search
            </button>
            <button onClick={() => loadRecords(page)} className="btn-secondary h-9 inline-flex items-center gap-1.5">
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={openCreate} className="btn-gold h-9 inline-flex items-center gap-1.5">
              <Plus size={13} /> Add Record
            </button>
          </div>

          <div className="mt-4 border-t border-brand-green/20 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-sage uppercase tracking-wider">
                <Filter size={13} /> Filters
              </div>
              <button
                onClick={() => setFilters(prev => [...prev, newFilter(fields[0]?.field_name || '')])}
                className="btn-secondary h-7 px-2 text-xs inline-flex items-center gap-1"
              >
                <Plus size={11} /> Add Filter
              </button>
            </div>
            {filters.length === 0 ? (
              <div className="text-xs text-brand-sage/45">No filters. Add filters to narrow this table like an Airtable view.</div>
            ) : (
              <div className="space-y-2">
                {filters.map(filter => (
                  <div key={filter.id} className="grid grid-cols-1 md:grid-cols-[220px_160px_1fr_32px] gap-2">
                    <select
                      value={filter.field}
                      onChange={event => updateFilter(filter.id, { field: event.target.value })}
                      className="select h-8 text-xs"
                    >
                      {fields.map(field => <option key={field.field_id} value={field.field_name}>{field.field_name}</option>)}
                    </select>
                    <select
                      value={filter.op}
                      onChange={event => updateFilter(filter.id, { op: event.target.value as FilterRow['op'] })}
                      className="select h-8 text-xs"
                    >
                      {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    <input
                      value={filter.value}
                      disabled={filter.op === 'blank' || filter.op === 'not_blank'}
                      onChange={event => updateFilter(filter.id, { value: event.target.value })}
                      className="input h-8 text-xs disabled:opacity-40"
                      placeholder="Filter value"
                    />
                    <button
                      onClick={() => setFilters(prev => prev.filter(item => item.id !== filter.id))}
                      className="h-8 rounded border border-brand-green/20 text-brand-sage/70 hover:text-brand-brightred hover:border-brand-red/30"
                      title="Remove filter"
                    >
                      <X size={13} className="mx-auto" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setFilters([]); loadRecords(1, search, []); }} className="btn-secondary h-8 text-xs">Clear Filters</button>
                  <button onClick={() => loadRecords(1)} className="btn-primary h-8 text-xs">Apply Filters</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-2 rounded border border-brand-sage/30 bg-brand-green/10 px-3 py-2 text-xs text-brand-sage">
            <CheckCircle size={13} /> {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-brightred">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-350px)]">
            <table className="ops-table min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="min-w-40 sticky left-0 z-30 bg-brand-dark">Record</th>
                  {columns.map(column => (
                    <th key={column} className="min-w-44 whitespace-nowrap bg-brand-dark">
                      <div className="flex flex-col gap-0.5">
                        <span>{column}</span>
                        <span className="normal-case tracking-normal text-[9px] text-brand-sage/35">
                          {fields.find(field => field.field_name === column)?.field_type || 'field'}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="min-w-32 bg-brand-dark">Synced</th>
                  <th className="min-w-32 bg-brand-dark text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + 3} className="py-12 text-center text-brand-sage/60">
                      <Loader2 size={18} className="animate-spin mx-auto mb-2" />
                      Loading records...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 3} className="py-12 text-center text-brand-sage/45">
                      No records match the current search/filter.
                    </td>
                  </tr>
                ) : records.map(record => (
                  <tr key={record.record_id} className="table-row-hover align-top">
                    <td className="font-mono text-brand-sage/75 sticky left-0 z-10 bg-brand-forest">
                      <details>
                        <summary className="cursor-pointer">{record.record_id}</summary>
                        <pre className="mt-2 max-w-xl overflow-auto rounded bg-brand-dark p-3 text-[10px] text-brand-warm/70">
                          {JSON.stringify(record.raw_fields, null, 2)}
                        </pre>
                      </details>
                    </td>
                    {columns.map(column => {
                      const value = cellValue(record.raw_fields[column]);
                      return (
                        <td key={`${record.record_id}-${column}`} className="max-w-72 truncate" title={plainValue(record.raw_fields[column])}>
                          <span className={value === '—' ? 'text-brand-warm/30' : ''}>{value}</span>
                        </td>
                      );
                    })}
                    <td className="text-brand-warm/50 whitespace-nowrap">{formatDate(record.last_synced_at)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(record)} className="btn-secondary h-8 px-2 inline-flex items-center gap-1 text-xs">
                          <Edit3 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => deleteRecord(record)}
                          className="h-8 px-2 rounded border border-brand-red/30 text-brand-brightred hover:bg-brand-red/10 inline-flex items-center gap-1 text-xs"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-brand-green/20 px-4 py-3 text-xs">
            <div className="text-brand-warm/50">
              Page {page} of {totalPages} · {total.toLocaleString()} rows
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadRecords(Math.max(page - 1, 1))}
                disabled={page <= 1 || loading}
                className="btn-secondary text-xs py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => loadRecords(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages || loading}
                className="btn-secondary text-xs py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-brand-green/20 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-brand-cream">
                  {modal.mode === 'create' ? `Add ${selectedTableName} Record` : `Edit ${modal.record?.record_id}`}
                </h3>
                <p className="text-xs text-brand-sage/50">Writable Airtable fields only. Formula, lookup, rollup, and attachment fields are read-only here.</p>
              </div>
              <button onClick={() => setModal(null)} className="p-2 rounded hover:bg-brand-green/20 text-brand-sage">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {editableFields.length === 0 ? (
                <div className="text-brand-sage/60 text-sm">This table has no generic editable fields available.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {editableFields.map(field => {
                    const choices = fieldChoices(field);
                    return (
                      <label key={field.field_id} className="block">
                        <span className="label block mb-1.5">
                          {field.field_name}
                          <span className="ml-1 normal-case tracking-normal text-brand-sage/35">({field.field_type})</span>
                        </span>
                        {field.field_type === 'checkbox' ? (
                          <select
                            value={formValues[field.field_name] || 'false'}
                            onChange={event => setFormValues(prev => ({ ...prev, [field.field_name]: event.target.value }))}
                            className="select h-9 text-xs"
                          >
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </select>
                        ) : field.field_type === 'singleSelect' && choices.length > 0 ? (
                          <select
                            value={formValues[field.field_name] || ''}
                            onChange={event => setFormValues(prev => ({ ...prev, [field.field_name]: event.target.value }))}
                            className="select h-9 text-xs"
                          >
                            <option value="">Empty</option>
                            {choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
                          </select>
                        ) : field.field_type === 'multilineText' || field.field_type === 'richText' ? (
                          <textarea
                            value={formValues[field.field_name] || ''}
                            onChange={event => setFormValues(prev => ({ ...prev, [field.field_name]: event.target.value }))}
                            className="input min-h-24 text-xs"
                          />
                        ) : (
                          <input
                            type={field.field_type === 'date' ? 'date' : field.field_type === 'dateTime' ? 'datetime-local' : ['number', 'currency', 'percent', 'duration', 'rating'].includes(field.field_type) ? 'number' : 'text'}
                            value={formValues[field.field_name] || ''}
                            onChange={event => setFormValues(prev => ({ ...prev, [field.field_name]: event.target.value }))}
                            className="input h-9 text-xs"
                            placeholder={field.field_type === 'multipleSelects' ? 'Comma-separated choices' : undefined}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-brand-green/20 flex items-center justify-end gap-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveRecord} disabled={saving || editableFields.length === 0} className="btn-gold inline-flex items-center gap-1.5 disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save to Airtable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
