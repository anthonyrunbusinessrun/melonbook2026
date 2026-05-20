export const dynamic = "force-dynamic";
import { query } from '@/db';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

export default async function AnomaliesPage() {
  const [active, resolved] = await Promise.all([
    query<{
      id: string; table_name: string; flag_type: string;
      severity: string; description: string; created_at: string;
    }>(
      `SELECT id, table_name, flag_type, severity, description, created_at
       FROM anomaly_flags WHERE resolved = false
       ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT 100`
    ),
    query<{
      id: string; flag_type: string; severity: string;
      description: string; resolved_at: string;
    }>(
      `SELECT id, flag_type, severity, description, resolved_at
       FROM anomaly_flags WHERE resolved = true
       ORDER BY resolved_at DESC LIMIT 20`
    ),
  ]);

  const sevIcon = (s: string) => {
    if (s === 'error') return <XCircle size={13} className="text-brand-brightred" />;
    if (s === 'warning') return <AlertTriangle size={13} className="text-brand-gold" />;
    return <Info size={13} className="text-brand-sage" />;
  };

  const sevBadge = (s: string) => {
    if (s === 'error') return 'badge-red';
    if (s === 'warning') return 'badge-gold';
    return 'badge-green';
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand-cream">Anomalies</h1>
        <p className="text-brand-sage/60 text-sm">
          Auto-detected data issues — nightly reconciliation flags
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card border-brand-red/20">
          <span className="label">Errors</span>
          <span className="text-xl font-bold text-brand-brightred">
            {active.filter(a => a.severity === 'error').length}
          </span>
        </div>
        <div className="stat-card border-brand-gold/20">
          <span className="label">Warnings</span>
          <span className="text-xl font-bold text-brand-gold">
            {active.filter(a => a.severity === 'warning').length}
          </span>
        </div>
        <div className="stat-card">
          <span className="label">Info</span>
          <span className="text-xl font-bold text-brand-sage">
            {active.filter(a => a.severity === 'info').length}
          </span>
        </div>
      </div>

      {/* Active anomalies */}
      <div className="card">
        <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-cream">Active Anomalies</h2>
          {active.length > 0 && <span className="badge-red">{active.length}</span>}
        </div>
        {active.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2 text-brand-sage">
            <CheckCircle size={24} />
            <div className="text-sm">No active anomalies</div>
            <div className="text-xs text-brand-sage/50">Run nightly reconciliation to detect new issues</div>
          </div>
        ) : (
          <table className="ops-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Table</th>
                <th>Description</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {active.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {sevIcon(a.severity)}
                      <span className={sevBadge(a.severity)}>{a.severity}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-brand-warm/60">{a.flag_type.replace(/_/g, ' ')}</td>
                  <td className="text-brand-warm/60">{a.table_name}</td>
                  <td className="text-brand-warm/80 max-w-xs">{a.description}</td>
                  <td className="text-brand-warm/40">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Anomaly types reference */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-brand-cream mb-3">Detection Rules</h3>
        <div className="grid grid-cols-2 gap-3 text-xs text-brand-warm/60">
          {[
            { type: 'negative_balance', desc: 'Customer balance_due < 0 (overpayment or data error)', sev: 'error' },
            { type: 'overpayment', desc: 'amount_paid > total_invoiced + $0.01', sev: 'warning' },
            { type: 'aged_balance', desc: 'balance_due > 0 and invoice older than 90 days', sev: 'warning' },
            { type: 'missing_customer_code', desc: 'Voucher with no issued_contact_id', sev: 'error' },
            { type: 'missing_invoice_date', desc: 'Voucher with invoiced amount but no accrue_date', sev: 'warning' },
            { type: 'missing_airtable_id', desc: 'Postgres record not linked to Airtable', sev: 'info' },
            { type: 'duplicate_lot', desc: 'Same lot_no on multiple vouchers for same customer', sev: 'warning' },
            { type: 'sync_failure', desc: 'Outbox entry failed after 5 attempts', sev: 'error' },
          ].map(r => (
            <div key={r.type} className="flex items-start gap-2 border-b border-brand-green/10 pb-2">
              {sevIcon(r.sev)}
              <div>
                <div className="font-mono text-brand-warm/70">{r.type}</div>
                <div className="text-brand-warm/40">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recently resolved */}
      {resolved.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-brand-green/20">
            <h2 className="text-sm font-semibold text-brand-cream/50">Recently Resolved</h2>
          </div>
          <table className="ops-table opacity-60">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map(a => (
                <tr key={a.id}>
                  <td className="font-mono text-xs">{a.flag_type}</td>
                  <td>{a.description}</td>
                  <td>{new Date(a.resolved_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
