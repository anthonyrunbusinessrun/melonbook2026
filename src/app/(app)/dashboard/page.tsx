export const dynamic = "force-dynamic";
import { buildARReport, getARSummary, getMirrorARSummary } from '@/lib/ar-engine';
import { query } from '@/db';
import {
  DollarSign, TrendingUp, AlertTriangle, RefreshCw,
  CheckCircle, XCircle, Clock, Users, FileText,
  Table2, ClipboardList, Database, Printer, ArrowRight,
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
  const [
    arSummary,
    mirrorSummary,
    syncRuns,
    anomalies,
    recentVouchers,
    mirrorCoverage,
    tableHealth,
    manualARSummary,
    arReport,
  ] = await Promise.allSettled([
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
    query<{
      table_count: string;
      field_count: string;
      view_count: string;
      record_count: string;
      stale_count: string;
      error_count: string;
      last_records_synced_at: string | null;
    }>(`
      SELECT
        COUNT(DISTINCT s.table_id)::text as table_count,
        (SELECT COUNT(*)::text FROM airtable_fields) as field_count,
        (SELECT COUNT(*)::text FROM airtable_views) as view_count,
        COALESCE(SUM(s.record_count), 0)::text as record_count,
        COUNT(*) FILTER (
          WHERE s.records_synced_at IS NULL
             OR s.records_synced_at < NOW() - INTERVAL '20 minutes'
        )::text as stale_count,
        COUNT(*) FILTER (WHERE s.sync_error IS NOT NULL)::text as error_count,
        MAX(s.records_synced_at)::text as last_records_synced_at
      FROM airtable_sync_status s
    `),
    query<{
      table_id: string;
      table_name: string;
      record_count: number;
      status: string;
      records_synced_at: string | null;
      sync_error: string | null;
    }>(`
      SELECT table_id, table_name, record_count, status, records_synced_at::text, sync_error
      FROM airtable_sync_status
      ORDER BY record_count DESC, table_name
      LIMIT 10
    `),
    query<{
      count: string;
      total_invoiced: string;
      total_paid: string;
      balance_due: string;
    }>(`
      SELECT
        COUNT(*)::text as count,
        COALESCE(SUM(total_invoiced), 0)::text as total_invoiced,
        COALESCE(SUM(amount_paid), 0)::text as total_paid,
        COALESCE(SUM(balance_due), 0)::text as balance_due
      FROM ar_manual_entries
      WHERE entry_status <> 'void'
    `),
    buildARReport({ includeZeroBalance: false }),
  ]);

  const ar = arSummary.status === 'fulfilled' ? arSummary.value : {
    totalInvoiced: 0, totalPaid: 0, totalBalance: 0,
    customerCount: 0, openInvoiceCount: 0, overdueCount: 0,
  };

  const mirror = mirrorSummary.status === 'fulfilled' ? mirrorSummary.value : null;
  const runs = syncRuns.status === 'fulfilled' ? syncRuns.value : [];
  const flags = anomalies.status === 'fulfilled' ? anomalies.value : [];
  const vouchers = recentVouchers.status === 'fulfilled' ? recentVouchers.value : [];
  const coverage = mirrorCoverage.status === 'fulfilled' ? mirrorCoverage.value[0] : null;
  const tables = tableHealth.status === 'fulfilled' ? tableHealth.value : [];
  const manual = manualARSummary.status === 'fulfilled' ? manualARSummary.value[0] : null;
  const topCustomers = arReport.status === 'fulfilled'
    ? arReport.value.customers
      .filter(customer => Math.abs(customer.balanceDue) > 0.01)
      .sort((a, b) => Math.abs(b.balanceDue) - Math.abs(a.balanceDue))
      .slice(0, 6)
    : [];

  const lastSync = runs[0];
  const syncOk = lastSync && !lastSync.error_message;
  const coverageRecordCount = Number(coverage?.record_count || 0);
  const staleTableCount = Number(coverage?.stale_count || 0);
  const errorTableCount = Number(coverage?.error_count || 0);

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <ActionCard
          title="Enter AR"
          desc="Use the familiar spreadsheet columns and formulas."
          href="/ar-input"
          icon={ClipboardList}
          tone="gold"
        />
        <ActionCard
          title="Print AR Report"
          desc="Export Excel or PDF for accounting review."
          href="/ar-report"
          icon={Printer}
          tone="green"
        />
        <ActionCard
          title="Review Airtable Tables"
          desc="Every MelonBook 2026 table in an Airtable-style grid."
          href="/data-explorer"
          icon={Table2}
          tone="sage"
        />
        <ActionCard
          title="Check Sync"
          desc="Confirm Railway Postgres is matching Airtable."
          href="/sync"
          icon={Database}
          tone={errorTableCount > 0 || staleTableCount > 0 ? 'red' : 'green'}
        />
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Airtable Tables"
          value={Number(coverage?.table_count || 0).toLocaleString()}
          icon={Table2}
          color="sage"
        />
        <StatCard
          label="Airtable Fields"
          value={Number(coverage?.field_count || 0).toLocaleString()}
          icon={Database}
          color="warm"
        />
        <StatCard
          label="Mirrored Records"
          value={coverageRecordCount.toLocaleString()}
          icon={Database}
          color={coverageRecordCount > 0 ? 'green' : 'gold'}
          highlight={coverageRecordCount === 0}
        />
        <StatCard
          label="Tables Need Attention"
          value={(staleTableCount + errorTableCount).toLocaleString()}
          icon={AlertTriangle}
          color={staleTableCount + errorTableCount > 0 ? 'red' : 'sage'}
          highlight={staleTableCount + errorTableCount > 0}
        />
      </div>

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
          <div className="card">
            <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-cream">Largest Open Balances</h2>
              <Link href="/ar-report" className="text-xs text-brand-sage hover:text-brand-cream transition-colors">
                Open AR →
              </Link>
            </div>
            <div className="p-3 space-y-2">
              {topCustomers.length === 0 ? (
                <div className="text-center py-4 text-brand-sage/40 text-xs">No open balances found yet</div>
              ) : (
                topCustomers.map(customer => (
                  <Link
                    key={customer.customerCode}
                    href={`/ar-report?customer=${encodeURIComponent(customer.customerCode)}`}
                    className="flex items-center justify-between gap-3 rounded border border-brand-green/10 bg-brand-dark/20 px-3 py-2 hover:border-brand-sage/30 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-mono text-brand-sage">{customer.customerCode}</div>
                      <div className="text-xs text-brand-warm/60 truncate max-w-[180px]">{customer.customerName}</div>
                    </div>
                    <div className={`text-xs font-mono font-semibold ${customer.balanceDue > 0 ? 'text-brand-gold' : 'text-brand-brightred'}`}>
                      {fmt(customer.balanceDue)}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 card">
          <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-cream">Airtable Table Coverage</h2>
            <Link href="/data-explorer" className="text-xs text-brand-sage hover:text-brand-cream transition-colors">
              Browse all tables →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th className="text-right">Records</th>
                  <th>Status</th>
                  <th>Records Synced</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {tables.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-brand-sage/40">No Airtable mirror status yet. Run a full mirror sync.</td></tr>
                ) : (
                  tables.map(table => (
                    <tr key={table.table_id}>
                      <td>
                        <div className="font-medium text-brand-cream">{table.table_name}</div>
                        <div className="font-mono text-[10px] text-brand-warm/35">{table.table_id}</div>
                        {table.sync_error && <div className="text-[10px] text-brand-brightred mt-1">{table.sync_error}</div>}
                      </td>
                      <td className="text-right font-mono">{Number(table.record_count || 0).toLocaleString()}</td>
                      <td>
                        <span className={table.sync_error ? 'badge-red' : table.status === 'ok' ? 'badge-green' : table.status === 'running' ? 'badge-gold' : 'badge-gray'}>
                          {table.sync_error ? 'error' : table.status}
                        </span>
                      </td>
                      <td className="text-brand-warm/50">{fmtDate(table.records_synced_at)}</td>
                      <td>
                        <Link href={`/data-explorer?table=${table.table_id}`} className="text-brand-sage hover:text-brand-cream text-xs">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold text-brand-cream">Accounting Snapshot</h2>
          <p className="text-xs text-brand-sage/55 mt-1">
            AR numbers are pulled from synced Postgres data and checked against Airtable accounting views.
          </p>
          <div className="space-y-3 mt-4">
            <MiniMetric label="Manual AR Entries" value={Number(manual?.count || 0).toLocaleString()} />
            <MiniMetric label="Manual AR Total" value={fmt(Number(manual?.total_invoiced || 0))} />
            <MiniMetric label="Manual AR Paid" value={fmt(Number(manual?.total_paid || 0))} />
            <MiniMetric label="Manual AR Balance" value={fmt(Number(manual?.balance_due || 0))} important />
            <MiniMetric label="Last Airtable Mirror" value={fmtDate(coverage?.last_records_synced_at || null)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tone: 'green' | 'sage' | 'gold' | 'red';
}) {
  const toneMap = {
    green: 'text-brand-sage border-brand-sage/20',
    sage: 'text-brand-sage/80 border-brand-green/20',
    gold: 'text-brand-gold border-brand-gold/25',
    red: 'text-brand-brightred border-brand-red/30',
  };

  return (
    <Link href={href} className={`card p-4 border ${toneMap[tone]} hover:border-brand-sage/40 transition-colors group`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded bg-brand-dark flex items-center justify-center shrink-0">
            <Icon size={17} className={toneMap[tone].split(' ')[0]} />
          </div>
          <div>
            <div className="text-sm font-semibold text-brand-cream">{title}</div>
            <div className="text-xs text-brand-warm/55 mt-1 leading-relaxed">{desc}</div>
          </div>
        </div>
        <ArrowRight size={14} className="text-brand-sage/35 group-hover:text-brand-sage shrink-0 mt-1" />
      </div>
    </Link>
  );
}

function MiniMetric({ label, value, important }: { label: string; value: React.ReactNode; important?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-green/10 pb-2 last:border-b-0">
      <span className="text-xs text-brand-warm/55">{label}</span>
      <span className={`text-xs font-mono font-semibold ${important ? 'text-brand-gold' : 'text-brand-cream'}`}>{value}</span>
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
