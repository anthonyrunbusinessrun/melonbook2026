'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, Play, Database, Zap, AlertTriangle } from 'lucide-react';

type TableStatus = {
  table_id: string; table_name: string;
  airtable_count: number | null; mirrored_count: number | null;
  last_synced_at: string | null; sync_started_at: string | null;
  status: string; error_message: string | null; duration_ms: number | null;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function SyncCenterPage() {
  const [tableStatus, setTableStatus] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/airtable/status');
      const data = await res.json();
      setTableStatus(data.tables || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function runSync(type: string, endpoint?: string) {
    setRunning(type);
    setResult(null);
    setError(null);
    try {
      const url = endpoint || `/api/sync/${type}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(data);
      await fetchStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  const totalMirrored = tableStatus.reduce((s, t) => s + (t.mirrored_count || 0), 0);
  const hasErrors = tableStatus.some(t => t.status === 'error');
  const anyRunning = tableStatus.some(t => t.status === 'running') || running !== null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Sync Center</h1>
          <p className="text-brand-sage/60 text-sm">
            Airtable ↔ PostgreSQL — Base: appmnU55C5f7A50U4 · Melonbook™ 2026
          </p>
        </div>
        <button onClick={fetchStatus} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
          <RefreshCw size={12} className={anyRunning ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="label">Total Tables</div>
          <div className="text-2xl font-bold text-brand-cream">{tableStatus.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Mirrored</div>
          <div className="text-2xl font-bold text-brand-cream">{totalMirrored.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Status</div>
          <div className={`text-lg font-bold ${hasErrors ? 'text-brand-brightred' : anyRunning ? 'text-brand-gold' : 'text-brand-sage'}`}>
            {hasErrors ? '⚠ Errors' : anyRunning ? '⟳ Syncing' : '✓ Ready'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Last Sync</div>
          <div className="text-sm text-brand-cream">
            {fmtDate(tableStatus.filter(t => t.last_synced_at).sort((a,b) =>
              new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime()
            )[0]?.last_synced_at || null)}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="card p-4">
        <h2 className="font-semibold text-brand-cream mb-3 text-sm">Sync Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runSync('full-mirror', '/api/airtable/sync/full')}
            disabled={running !== null}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Zap size={14} className={running === 'full-mirror' ? 'animate-spin' : ''} />
            {running === 'full-mirror' ? 'Syncing All…' : 'Sync All Tables'}
          </button>
          <button
            onClick={() => runSync('schema', '/api/airtable/sync/schema')}
            disabled={running !== null}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Database size={14} className={running === 'schema' ? 'animate-spin' : ''} />
            Sync Schema
          </button>
          <button
            onClick={() => runSync('outbox', '/api/sync/outbox')}
            disabled={running !== null}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Play size={14} /> Process Outbox
          </button>
          <button
            onClick={() => runSync('contacts', '/api/sync/contacts')}
            disabled={running !== null}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} className={running === 'contacts' ? 'animate-spin' : ''} />
            Sync Contacts
          </button>
          <button
            onClick={() => runSync('transactions', '/api/sync/transactions')}
            disabled={running !== null}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} className={running === 'transactions' ? 'animate-spin' : ''} />
            Sync Transactions
          </button>
        </div>

        {result && (
          <div className="mt-3 p-3 bg-brand-sage/10 border border-brand-sage/20 rounded text-xs">
            <p className="text-brand-sage font-medium mb-1">✓ Sync completed</p>
            <pre className="text-brand-cream/70 overflow-auto max-h-40">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 bg-brand-red/10 border border-brand-red/30 rounded text-xs">
            <p className="text-brand-brightred font-medium">✗ Error: {error}</p>
          </div>
        )}
      </div>

      {/* Per-table status */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
          <h2 className="font-semibold text-brand-cream text-sm">Airtable Tables — Mirror Status</h2>
          <span className="text-xs text-brand-sage/40">Refreshes every 10s</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-brand-sage/40">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            Loading sync status…
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-dark/30">
                {['Table', 'Airtable', 'Mirrored', 'Status', 'Last Synced', 'Duration', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-brand-sage/60 font-medium border-b border-brand-green/20">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableStatus.map(t => (
                <tr key={t.table_id} className="table-row-hover border-b border-brand-green/10">
                  <td className="px-4 py-2.5 font-medium text-brand-cream">
                    {t.table_name}
                    <div className="text-brand-sage/40 font-mono text-[10px]">{t.table_id}</div>
                  </td>
                  <td className="px-4 py-2.5 text-brand-cream/80">
                    {t.airtable_count?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${(t.mirrored_count || 0) > 0 ? 'text-brand-sage' : 'text-brand-sage/40'}`}>
                      {(t.mirrored_count || 0).toLocaleString()}
                    </span>
                    {t.airtable_count && t.mirrored_count && t.airtable_count > t.mirrored_count && (
                      <span className="ml-1 text-brand-gold">
                        ({t.airtable_count - t.mirrored_count} pending)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${
                      t.status === 'done' ? 'badge-green' :
                      t.status === 'running' ? 'badge-gold' :
                      t.status === 'error' ? 'badge-red' : 'badge-gray'
                    }`}>
                      {t.status === 'running' && <RefreshCw size={10} className="mr-1 animate-spin" />}
                      {t.status === 'done' && <CheckCircle size={10} className="mr-1" />}
                      {t.status === 'error' && <XCircle size={10} className="mr-1" />}
                      {t.status === 'idle' && <Clock size={10} className="mr-1" />}
                      {t.status}
                    </span>
                    {t.error_message && (
                      <div className="text-brand-brightred text-[10px] mt-0.5 max-w-[200px] truncate" title={t.error_message}>
                        {t.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-brand-sage/60">{fmtDate(t.last_synced_at)}</td>
                  <td className="px-4 py-2.5 text-brand-sage/60">{fmtDuration(t.duration_ms)}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => runSync(`table-${t.table_id}`, `/api/airtable/sync/table/${t.table_id}`)}
                      disabled={running !== null || t.status === 'running'}
                      className="text-xs text-brand-sage hover:text-brand-cream transition-colors flex items-center gap-1 disabled:opacity-30"
                    >
                      <RefreshCw size={11} className={running === `table-${t.table_id}` ? 'animate-spin' : ''} />
                      Sync
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Webhook info */}
      <div className="card p-4">
        <h2 className="font-semibold text-brand-cream mb-2 text-sm">Airtable Webhook</h2>
        <div className="flex items-center gap-3">
          <code className="text-xs text-brand-sage bg-brand-dark/40 px-3 py-1.5 rounded font-mono flex-1">
            POST https://melonbook2026-production.up.railway.app/api/webhooks/airtable
          </code>
          <a
            href="https://airtable.com/create/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-1.5"
          >
            Manage Webhooks →
          </a>
        </div>
        <p className="text-xs text-brand-sage/40 mt-2">
          Register this URL in Airtable to enable near-real-time sync triggers.
        </p>
      </div>
    </div>
  );
}
