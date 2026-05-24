'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Play, Database, Zap, Table2 } from 'lucide-react';
import Link from 'next/link';

type SyncRun = {
  id: string; direction: string; table_name: string;
  records_processed: number; records_failed: number; records_skipped: number;
  started_at: string; completed_at: string | null; error_message: string | null;
};

type OutboxItem = {
  id: string; table_name: string; operation: string;
  status: string; attempts: number; created_at: string; error_message: string | null;
};

type ConflictItem = {
  id: string; table_name: string; winner: string; resolved_at: string;
};

type MirrorTable = {
  table_id: string;
  table_name: string;
  record_count: number;
  status: string;
  records_synced_at: string | null;
  schema_synced_at: string | null;
  sync_error: string | null;
};

type MirrorViewStat = {
  view_id: string;
  view_name: string;
  record_count: number;
  debit_total: number;
  credit_total: number;
  last_synced_at: string;
  sync_error: string | null;
};

type MirrorStatus = {
  tables: MirrorTable[];
  viewStats: MirrorViewStat[];
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

export default function SyncCenterPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirror, setMirror] = useState<MirrorStatus | null>(null);
  const [loadingMirror, setLoadingMirror] = useState(true);

  async function loadMirrorStatus() {
    setLoadingMirror(true);
    try {
      const res = await fetch('/api/airtable/status', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load Airtable status');
      setMirror({ tables: data.tables || [], viewStats: data.viewStats || [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMirror(false);
    }
  }

  useEffect(() => {
    loadMirrorStatus();
  }, []);

  async function runSync(type: string) {
    setRunning(type);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/sync/${type}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  async function runMirrorSync(path: string, label: string) {
    setRunning(label);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(path, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Airtable mirror sync failed');
      setResult(data);
      await loadMirrorStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  const totalMirrorRecords = mirror?.tables.reduce((sum, table) => sum + Number(table.record_count || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand-cream">Sync Center</h1>
        <p className="text-brand-sage/60 text-sm">
          Airtable ↔ PostgreSQL bidirectional sync — MelonBook™ 2026 (appmnU55C5f7A50U4)
        </p>
      </div>

      {/* Airtable mirror controls */}
      <div className="card p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-brand-cream">Full Airtable Mirror</h2>
            <p className="text-xs text-brand-sage/55 mt-1">
              Pulls every Airtable table, field, view, and record into Railway Postgres so the app always has a complete copy of MelonBook 2026.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/data-explorer" className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              <Table2 size={13} />
              Data Explorer
            </Link>
            <button
              onClick={() => runMirrorSync('/api/airtable/sync/schema', 'airtable-schema')}
              disabled={running !== null}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"
            >
              <RefreshCw size={13} className={running === 'airtable-schema' ? 'animate-spin' : ''} />
              Sync Schema
            </button>
            <button
              onClick={() => runMirrorSync('/api/airtable/sync/full', 'airtable-full')}
              disabled={running !== null}
              className="btn-gold flex items-center gap-1.5 text-xs py-1.5"
            >
              <Database size={13} />
              Full Airtable Mirror Sync
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Mirrored Tables', value: mirror?.tables.length || 0 },
            { label: 'Mirrored Records', value: totalMirrorRecords.toLocaleString() },
            { label: 'Accounting Views', value: mirror?.viewStats.length || 0 },
            { label: 'Tables With Errors', value: mirror?.tables.filter(table => table.sync_error).length || 0 },
          ].map(item => (
            <div key={item.label} className="stat-card">
              <span className="label">{item.label}</span>
              <span className="text-base font-semibold text-brand-cream font-mono">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Table</th>
                <th className="text-right">Records</th>
                <th>Status</th>
                <th>Schema Synced</th>
                <th>Records Synced</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingMirror && (
                <tr><td colSpan={6} className="text-center text-brand-sage/50 py-6">Loading mirror status...</td></tr>
              )}
              {!loadingMirror && mirror?.tables.length === 0 && (
                <tr><td colSpan={6} className="text-center text-brand-sage/50 py-6">No Airtable schema mirrored yet. Run Sync Schema or Full Airtable Mirror Sync.</td></tr>
              )}
              {mirror?.tables.map(table => (
                <tr key={table.table_id}>
                  <td>
                    <Link href={`/data-explorer?table=${table.table_id}`} className="text-brand-cream hover:text-brand-sage">
                      {table.table_name}
                    </Link>
                    <div className="font-mono text-[10px] text-brand-warm/40">{table.table_id}</div>
                    {table.sync_error && <div className="text-[10px] text-brand-brightred mt-1">{table.sync_error}</div>}
                  </td>
                  <td className="text-right font-mono">{Number(table.record_count || 0).toLocaleString()}</td>
                  <td>
                    <span className={table.status === 'ok' ? 'badge-green' : table.status === 'running' ? 'badge-gold' : 'badge-gray'}>
                      {table.status}
                    </span>
                  </td>
                  <td className="text-brand-warm/50">{fmtDate(table.schema_synced_at)}</td>
                  <td className="text-brand-warm/50">{fmtDate(table.records_synced_at)}</td>
                  <td className="text-right">
                    <button
                      onClick={() => runMirrorSync(`/api/airtable/sync/table/${table.table_id}`, table.table_id)}
                      disabled={running !== null}
                      className="btn-secondary text-xs py-1.5"
                    >
                      {running === table.table_id ? 'Syncing...' : 'Sync Table'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mirror?.viewStats && mirror.viewStats.length > 0 && (
          <div className="overflow-x-auto">
            <div className="text-xs font-semibold text-brand-sage uppercase tracking-wider mb-2">Accounting View Totals</div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>View</th>
                  <th className="text-right">Records</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th>Last Synced</th>
                </tr>
              </thead>
              <tbody>
                {mirror.viewStats.map(view => (
                  <tr key={view.view_id}>
                    <td className="text-brand-cream">{view.view_name}</td>
                    <td className="text-right font-mono">{Number(view.record_count || 0).toLocaleString()}</td>
                    <td className="text-right font-mono">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(view.debit_total || 0))}</td>
                    <td className="text-right font-mono">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(view.credit_total || 0))}</td>
                    <td className="text-brand-warm/50">{fmtDate(view.last_synced_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            id: 'full',
            label: 'Full Sync',
            desc: 'Import all tables from Airtable',
            icon: Database,
            color: 'green',
          },
          {
            id: 'contacts',
            label: 'Sync Contacts',
            desc: 'Customers, vendors, freight',
            icon: RefreshCw,
            color: 'sage',
          },
          {
            id: 'transactions',
            label: 'Sync Transactions',
            desc: 'Ledger entries (30K+ records)',
            icon: Zap,
            color: 'gold',
          },
          {
            id: 'outbox',
            label: 'Process Outbox',
            desc: 'Push Postgres changes → Airtable',
            icon: Play,
            color: 'warm',
          },
        ].map(action => (
          <div key={action.id} className="card p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand-dark rounded flex items-center justify-center shrink-0">
                <action.icon size={16} className="text-brand-sage" />
              </div>
              <div>
                <div className="text-sm font-semibold text-brand-cream">{action.label}</div>
                <div className="text-xs text-brand-warm/50">{action.desc}</div>
              </div>
            </div>
            <button
              onClick={() => runSync(action.id)}
              disabled={running !== null}
              className={`btn-primary text-xs py-1.5 flex items-center justify-center gap-1.5 ${running === action.id ? 'opacity-70' : ''}`}
            >
              {running === action.id ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={12} />
                  Run {action.label}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Result/Error */}
      {result && (
        <div className="card border-brand-sage/30 p-4">
          <div className="flex items-center gap-2 text-brand-sage mb-3">
            <CheckCircle size={14} />
            <span className="text-sm font-semibold">Sync completed</span>
          </div>
          <pre className="text-xs text-brand-warm/70 overflow-auto max-h-40 bg-brand-dark rounded p-3">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      {error && (
        <div className="card border-brand-red/30 p-4">
          <div className="flex items-center gap-2 text-brand-brightred mb-2">
            <XCircle size={14} />
            <span className="text-sm font-semibold">Sync failed</span>
          </div>
          <div className="text-xs text-brand-warm/60">{error}</div>
        </div>
      )}

      {/* Sync architecture info */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-brand-cream mb-3">Sync Architecture</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-brand-warm/60">
          <div>
            <div className="text-brand-sage font-medium mb-1">Airtable → Postgres</div>
            <ul className="space-y-1">
              <li>• Webhook events (realtime)</li>
              <li>• Scheduled reconciliation (nightly)</li>
              <li>• Field hash change detection</li>
              <li>• Latest-edit-wins conflict resolution</li>
            </ul>
          </div>
          <div>
            <div className="text-brand-sage font-medium mb-1">Postgres → Airtable</div>
            <ul className="space-y-1">
              <li>• Outbox pattern via triggers</li>
              <li>• Exponential backoff retry</li>
              <li>• Origin marker prevents loops</li>
              <li>• Batch writes (10 records/request)</li>
            </ul>
          </div>
          <div>
            <div className="text-brand-sage font-medium mb-1">Conflict Handling</div>
            <ul className="space-y-1">
              <li>• Compare last-modified timestamps</li>
              <li>• Both snapshots saved to audit table</li>
              <li>• Winner applied automatically</li>
              <li>• View conflicts in audit log</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Config reference */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-brand-cream mb-3">Airtable Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Base ID</span>
              <code className="text-brand-sage font-mono">appmnU55C5f7A50U4</code>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Contacts Table</span>
              <code className="text-brand-warm/60 font-mono">tblqy4XXa2ap3g66T</code>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Transactions Table</span>
              <code className="text-brand-warm/60 font-mono">tblfNYrQKvtOwslbr</code>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Vouchers Table</span>
              <code className="text-brand-warm/60 font-mono">tblUYAd8KBsZi97Pu</code>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-brand-sage/60">AR Account (1152)</span>
              <span className="text-brand-gold">Accounts Receivable</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Payment Account (1122)</span>
              <span className="text-brand-sage">Undeposited Funds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Total Transactions</span>
              <span className="text-brand-warm">~30,758</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-sage/60">Rate Limit</span>
              <span className="text-brand-warm/60">5 req/s with backoff</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
