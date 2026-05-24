export const dynamic = "force-dynamic";
import { getARSummary, getMirrorARSummary } from '@/lib/ar-engine';
import { query } from '@/db';
import {
  DollarSign, TrendingUp, AlertTriangle, RefreshCw,
  CheckCircle, XCircle, Clock, Users, FileText,
} from 'lucide-react';
import Link from 'next/link';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function DashboardPage() {
  // Parallel data fetching
  const [arSummary, mirrorSummary, syncRuns, anomalies, recentVouchers] = await Promise.allSettled([
    getARSummary(),
    getMirrorARSummary(),
    query<{ direction: string; started_at: string; completed_at: string; records_processed: number; error_message: string }>(
      `SELECT direction, started_at, completed_at, records_processed, error_message
       FROM sync_runs ORDER BY started_at DESC LIMIT 5`
    ),
    query<{ flag_type: string; severity: string; description: string; created_at: string; count: number }>(
      `SELECT flag_type, severity, description, created_at,
         COUNT(*) OVER (PARTITION BY flag_type) as count
       FROM anomaly_flags WHERE resolved = false ORDER BY created_at DESC LIMIT 8`
    ),
    query<{ customer_code: string; lot_no: string; invoiced: number; balance_due: number; accrue_date: string }>(
      `SELECT v.lot_no, v.invoiced_amount as invoiced, v.balance_due, v.accrue_date,
         c.code as customer_code
       FROM vouchers v JOIN contacts c ON c.id = v.issued_contact_id
       WHERE v.deleted_at IS NULL AND v.invoiced_amount > 0
       ORDER BY v.accrue_date DESC NULLS LAST LIMIT 8`
    ),
  ]);

  const ar = arSummary.status === 'fulfilled' ? arSummary.value : {
    totalInvoiced: 0, totalPaid: 0, totalBalance: 0,
    customerCount: 0, openInvoiceCount: 0, overdueCount: 0,
  };

  const mirror = mirrorSummary.status === 'fulfilled' ? mirrorSummary.value : null;
  const runs = syncRuns.status === 'fulfilled' ? syncRuns.value : [];
  const flags = anomalies.status === 'fulfilled' ? anomalies.value : [];
  const vouchers = recentVouchers.status === 'fulfilled' ? recentVouchers.value : [];

  const lastSync = runs[0];
  const syncOk = lastSync && !lastSync.error_message;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Operations Dashboard</h1>
          <p className="text-brand-sage/60 text-sm mt-1">
            Raymon J Land Watermelon Sales & Land Truck Brokers — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncOk ? (
            <span className="flex items-center gap-1.5 text-brand-sage text-xs">
              <span className="w-2 h-2 bg-brand-sage rounded-full sync-pulse" />
              Synced {fmtDate(lastSync.completed_at)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-brand-gold text-xs">
              <span className="w-2 h-2 bg-brand-gold rounded-full" />
              Sync status unknown
            </span>
          )}
          <Link href="/sync" className="btn-secondary text-xs py-1.5">
            <RefreshCw size={12} className="inline mr-1" />
            Sync Center
          </Link>
        </div>
      </div>

      {mirror && mirror.transactionRecordCount > 0 && (
        <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-brand-cream">Airtable Mirror Is Feeding This App</div>
            <div className="text-xs text-brand-sage/55 mt-1">
              {mirror.transactionRecordCount.toLocaleString()} Transaction records synced from MelonBook 2026. Accounting view totals are available in AR Report and Data Explorer.
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-brand-warm/60">1152 invoiced: <span className="text-brand-gold">{fmt(mirror.invoicedFromViews || mirror.invoicedFromRecords)}</span></span>
            <span className="text-brand-warm/60">1122 paid: <span className="text-brand-sage">{fmt(mirror.paidFromViews || mirror.paidFromRecords)}</span></span>
            <Link href="/data-explorer?table=tblfNYrQKvtOwslbr" className="btn-secondary text-xs py-1.5">Open Transactions</Link>
          </div>
        </div>
      )}

      {/* AR Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Total Invoiced"
          value={fmt(ar.totalInvoiced)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Amount Paid"
          value={fmt(ar.totalPaid)}
          icon={TrendingUp}
          color="sage"
        />
        <StatCard
          label="Balance Due"
          value={fmt(ar.totalBalance)}
          icon={DollarSign}
          color={ar.totalBalance > 0 ? 'gold' : 'green'}
          highlight={ar.totalBalance > 0}
        />
        <StatCard
          label="Customers"
          value={ar.customerCount.toString()}
          icon={Users}
          color="sage"
        />
        <StatCard
          label="Open Invoices"
          value={ar.openInvoiceCount.toString()}
          icon={FileText}
          color="warm"
        />
        <StatCard
          label="Overdue 30d+"
          value={ar.overdueCount.toString()}
          icon={AlertTriangle}
          color={ar.overdueCount > 0 ? 'red' : 'sage'}
          highlight={ar.overdueCount > 0}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent Vouchers */}
        <div className="xl:col-span-2 card">
          <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-cream">Recent Invoices</h2>
            <Link href="/ar-report" className="text-xs text-brand-sage hover:text-brand-cream transition-colors">
              View AR Report →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Lot #</th>
                  <th>Inv Date</th>
                  <th className="text-right">Invoiced</th>
                  <th className="text-right">Balance Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-brand-sage/40">No invoice data — run initial sync</td></tr>
                ) : (
                  vouchers.map((v, i) => (
                    <tr key={i}>
                      <td className="font-medium text-brand-cream">{v.customer_code}</td>
                      <td className="text-brand-sage/70">{v.lot_no || '—'}</td>
                      <td>{v.accrue_date ? new Date(v.accrue_date).toLocaleDateString() : '—'}</td>
                      <td className="text-right money">{fmt(v.invoiced)}</td>
                      <td className={`text-right font-medium ${v.balance_due > 0 ? 'money-negative' : v.balance_due < 0 ? 'money-negative' : 'money-zero'}`}>
                        {fmt(v.balance_due)}
                      </td>
                      <td>
                        {v.balance_due <= 0 ? (
                          <span className="badge-green">Paid</span>
                        ) : (
                          <span className="badge-gold">Open</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Sync + Anomalies */}
        <div className="space-y-4">
          {/* Sync Runs */}
          <div className="card">
            <div className="px-4 py-3 border-b border-brand-green/20">
              <h2 className="text-sm font-semibold text-brand-cream">Sync Health</h2>
            </div>
            <div className="p-3 space-y-2">
              {runs.length === 0 ? (
                <div className="text-center py-4 text-brand-sage/40 text-xs">No sync runs yet</div>
              ) : (
                runs.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {r.error_message ? (
                      <XCircle size={13} className="text-brand-brightred mt-0.5 shrink-0" />
                    ) : r.completed_at ? (
                      <CheckCircle size={13} className="text-brand-sage mt-0.5 shrink-0" />
                    ) : (
                      <Clock size={13} className="text-brand-gold mt-0.5 shrink-0 sync-pulse" />
                    )}
                    <div>
                      <div className="text-brand-warm">
                        {r.direction === 'at_to_pg' ? 'Airtable → Postgres' : 'Postgres → Airtable'}
                        {r.records_processed > 0 && <span className="text-brand-sage/60 ml-1">({r.records_processed} records)</span>}
                      </div>
                      <div className="text-brand-sage/40">{fmtDate(r.started_at)}</div>
                      {r.error_message && (
                        <div className="text-brand-brightred/80 mt-0.5 text-[10px]">{r.error_message.slice(0, 80)}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <Link href="/sync" className="block text-center text-xs text-brand-sage/60 hover:text-brand-sage pt-1 border-t border-brand-green/10">
                View Sync Center →
              </Link>
            </div>
          </div>

          {/* Anomalies */}
          <div className="card">
            <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-cream">Active Anomalies</h2>
              {flags.length > 0 && (
                <span className="badge-red">{flags.length}</span>
              )}
            </div>
            <div className="p-3 space-y-2">
              {flags.length === 0 ? (
                <div className="flex items-center gap-2 text-brand-sage text-xs py-2">
                  <CheckCircle size={13} />
                  No active anomalies
                </div>
              ) : (
                flags.slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs border-b border-brand-green/10 pb-2">
                    <AlertTriangle size={12} className={`mt-0.5 shrink-0 ${f.severity === 'error' ? 'text-brand-brightred' : 'text-brand-gold'}`} />
                    <div>
                      <div className="text-brand-warm">{f.description}</div>
                      <div className="text-brand-sage/40 capitalize">{f.flag_type.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color, highlight
}: {
  label: string; value: string; icon: React.ElementType;
  color: 'green' | 'sage' | 'gold' | 'red' | 'warm'; highlight?: boolean;
}) {
  const colorMap = {
    green: 'text-brand-sage',
    sage: 'text-brand-sage/70',
    gold: 'text-brand-gold',
    red: 'text-brand-brightred',
    warm: 'text-brand-warm/60',
  };
  return (
    <div className={`stat-card ${highlight ? 'border-brand-gold/40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <Icon size={13} className={colorMap[color]} />
      </div>
      <div className={`text-lg font-semibold font-mono tabular-nums ${colorMap[color]}`}>
        {value}
      </div>
    </div>
  );
}
