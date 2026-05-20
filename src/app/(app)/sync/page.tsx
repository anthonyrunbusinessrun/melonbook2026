'use client';
import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, Play, AlertTriangle, Database, Zap } from 'lucide-react';

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

export default function SyncCenterPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand-cream">Sync Center</h1>
        <p className="text-brand-sage/60 text-sm">
          Airtable ↔ PostgreSQL bidirectional sync — Melonbook™ 2026 (appmnU55C5f7A50U4)
        </p>
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
