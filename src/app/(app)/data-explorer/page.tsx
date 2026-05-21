'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Download, Eye, EyeOff, Database } from 'lucide-react';

const ALL_TABLES = [
  { id: 'tblfNYrQKvtOwslbr', name: 'Transactions', icon: '💳' },
  { id: 'tblqy4XXa2ap3g66T', name: 'Contacts', icon: '👥' },
  { id: 'tblxvWCSHdMKiOa56', name: 'Folios', icon: '📦' },
  { id: 'tblUYAd8KBsZi97Pu', name: 'Vouchers', icon: '🧾' },
  { id: 'tblmt7JoM80l0vO5I', name: 'Accounts', icon: '🏦' },
  { id: 'tblIdxdCej9QvdirO', name: 'Batches', icon: '📋' },
  { id: 'tblOarNFTnDsSaO75', name: 'Items', icon: '🛒' },
  { id: 'tbllwqsWIRSTKIVFf', name: 'Attachments', icon: '📎' },
  { id: 'tbl4vy605bt4KPDgA', name: 'Forms', icon: '📄' },
];

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  if (typeof val === 'number') return val.toLocaleString('en-US');
  if (Array.isArray(val)) {
    return val.map(v => {
      if (typeof v === 'object' && v !== null) return (v as Record<string,unknown>).name as string || JSON.stringify(v).slice(0,30);
      return String(v);
    }).join(', ').slice(0, 80);
  }
  if (typeof val === 'object') {
    const o = val as Record<string,unknown>;
    if ('name' in o) return String(o.name);
    if ('id' in o) return String(o.id);
    return JSON.stringify(val).slice(0, 60);
  }
  return String(val).slice(0, 100);
}

export default function DataExplorerPage() {
  const [selectedTableId, setSelectedTableId] = useState('tblfNYrQKvtOwslbr');
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [records, setRecords] = useState<Array<{airtable_record_id: string; raw_fields: Record<string,unknown>; created_time: string}>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [schema, setSchema] = useState<{fields: Array<{id: string; name: string; type: string}>; views: Array<{id: string; name: string}>} | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record<string,unknown> | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [showColPicker, setShowColPicker] = useState(false);

  const pageSize = 50;

  const selectedTable = ALL_TABLES.find(t => t.id === selectedTableId)!;

  // Load table counts
  useEffect(() => {
    fetch('/api/airtable/tables')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {};
        d.tables?.forEach((t: {id: string; mirrored_count: number}) => { map[t.id] = t.mirrored_count; });
        setTableCounts(map);
      })
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/airtable/tables/${selectedTableId}/records?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      if (data.schema?.fields) {
        const fields = data.schema.fields as Array<{id: string; name: string; type: string}>;
        setSchema(data.schema);
        if (visibleCols.length === 0) {
          setVisibleCols(fields.slice(0, 8).map((f: {name: string}) => f.name));
        }
      } else if (data.records?.length > 0) {
        const cols = Object.keys(data.records[0].raw_fields).slice(0, 8);
        setVisibleCols(cols);
      }
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }, [selectedTableId, page, search, visibleCols.length]);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableId, page, search]);

  const handleTableChange = (id: string) => {
    setSelectedTableId(id);
    setPage(1);
    setSearch('');
    setSearchInput('');
    setVisibleCols([]);
    setSelectedRecord(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const syncTable = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/airtable/sync/table/${selectedTableId}`, { method: 'POST' });
      await fetchRecords();
    } finally {
      setSyncing(false);
    }
  };

  const allCols = records.length > 0 ? Object.keys(records[0].raw_fields) : [];
  const displayCols = visibleCols.length > 0 ? visibleCols.filter(c => allCols.includes(c)) : allCols.slice(0, 8);
  const totalPages = Math.ceil(total / pageSize);
  const mirrored = tableCounts[selectedTableId] || 0;

  return (
    <div className="p-6 space-y-4 h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-cream flex items-center gap-2">
            <Database size={20} /> Data Explorer
          </h1>
          <p className="text-brand-sage/60 text-sm mt-0.5">Browse all Airtable tables mirrored in Postgres</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/airtable/sync/full" className="btn-secondary text-xs py-1.5 hidden">Full Sync</a>
          <a href="/sync" className="btn-secondary text-xs py-1.5">Sync Center</a>
        </div>
      </div>

      {/* Table picker */}
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
        {ALL_TABLES.map(t => (
          <button
            key={t.id}
            onClick={() => handleTableChange(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors
              ${selectedTableId === t.id
                ? 'bg-brand-midgreen text-white'
                : 'bg-brand-forest border border-brand-green/20 text-brand-sage hover:text-brand-cream hover:border-brand-sage/40'
              }`}
          >
            <span>{t.icon}</span>
            <span>{t.name}</span>
            {tableCounts[t.id] > 0 && (
              <span className="opacity-70">({tableCounts[t.id].toLocaleString()})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + controls */}
      <div className="flex gap-2 shrink-0">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={`Search ${selectedTable.name}...`}
              className="input pl-8 text-sm py-1.5"
            />
          </div>
          <button type="submit" className="btn-secondary text-xs py-1.5 px-3">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="btn-secondary text-xs py-1.5 px-3">Clear</button>
          )}
        </form>
        <button
          onClick={() => setShowColPicker(!showColPicker)}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
        >
          <Eye size={12} /> Columns
        </button>
        <button
          onClick={syncTable}
          disabled={syncing}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Table'}
        </button>
      </div>

      {/* Column picker */}
      {showColPicker && allCols.length > 0 && (
        <div className="card p-3 shrink-0">
          <p className="text-xs text-brand-sage/60 mb-2">Visible columns</p>
          <div className="flex flex-wrap gap-1.5">
            {allCols.map(col => (
              <button
                key={col}
                onClick={() => {
                  setVisibleCols(prev =>
                    prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
                  );
                }}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  displayCols.includes(col)
                    ? 'bg-brand-midgreen text-white'
                    : 'bg-brand-dark text-brand-sage/60 border border-brand-green/20'
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs text-brand-sage/60 shrink-0">
        <span>
          {loading ? 'Loading…' : (
            <>
              <strong className="text-brand-cream">{total.toLocaleString()}</strong> records
              {search && ` matching "${search}"`}
              {mirrored > 0 && ` · ${mirrored.toLocaleString()} total mirrored`}
            </>
          )}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1 rounded hover:bg-brand-green/20 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-1 rounded hover:bg-brand-green/20 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex gap-4 flex-1 overflow-hidden min-h-0">
        {/* Table */}
        <div className={`overflow-auto flex-1 card ${selectedRecord ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-brand-sage/40">
              <RefreshCw size={20} className="animate-spin mr-2" /> Loading records…
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-brand-sage/40">
              <Database size={32} />
              <div>
                <p className="font-medium text-brand-sage/60">No records found</p>
                <p className="text-xs text-center mt-1">
                  {search ? 'Try a different search' : 'Click "Sync Table" to pull data from Airtable'}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-brand-forest z-10">
                <tr>
                  <th className="text-left px-3 py-2 text-brand-sage/60 font-medium border-b border-brand-green/20 whitespace-nowrap">
                    Airtable ID
                  </th>
                  {displayCols.map(col => (
                    <th key={col} className="text-left px-3 py-2 text-brand-sage/60 font-medium border-b border-brand-green/20 whitespace-nowrap max-w-[200px]">
                      {col}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 text-brand-sage/60 font-medium border-b border-brand-green/20">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec, i) => (
                  <tr
                    key={rec.airtable_record_id}
                    onClick={() => setSelectedRecord(rec.raw_fields)}
                    className={`table-row-hover cursor-pointer ${
                      i % 2 === 0 ? '' : 'bg-brand-dark/20'
                    } ${selectedRecord === rec.raw_fields ? 'bg-brand-green/20' : ''}`}
                  >
                    <td className="px-3 py-1.5 font-mono text-brand-sage/50 whitespace-nowrap">
                      {rec.airtable_record_id.slice(-8)}
                    </td>
                    {displayCols.map(col => (
                      <td key={col} className="px-3 py-1.5 text-brand-cream/80 max-w-[200px] truncate">
                        {renderValue(rec.raw_fields[col])}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-brand-sage/40 whitespace-nowrap">
                      {rec.created_time ? new Date(rec.created_time).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Record detail drawer */}
        {selectedRecord && (
          <div className="w-full lg:w-96 shrink-0 card overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-green/20 sticky top-0 bg-brand-forest z-10">
              <h3 className="font-medium text-brand-cream text-sm">Record Detail</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-brand-sage/60 hover:text-brand-cream flex items-center gap-1"
                >
                  {showRaw ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showRaw ? 'Hide raw' : 'View raw fields'}
                </button>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-brand-sage/40 hover:text-brand-cream text-lg leading-none"
                >×</button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {showRaw ? (
                <pre className="text-xs font-mono text-brand-sage/70 overflow-auto bg-brand-dark/40 rounded p-3">
                  {JSON.stringify(selectedRecord, null, 2)}
                </pre>
              ) : (
                Object.entries(selectedRecord).map(([key, val]) => (
                  <div key={key} className="grid grid-cols-2 gap-2 text-xs border-b border-brand-green/10 pb-2">
                    <span className="text-brand-sage/60 font-medium truncate" title={key}>{key}</span>
                    <span className="text-brand-cream/80 break-words">{renderValue(val)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
