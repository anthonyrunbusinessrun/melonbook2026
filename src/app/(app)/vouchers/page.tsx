export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ClipboardList, DollarSign, FileText, Search, TrendingUp } from 'lucide-react';
import { query } from '@/db';

const VOUCHERS_TABLE_ID = 'tblUYAd8KBsZi97Pu';

type VoucherRecord = {
  record_id: string;
  raw_fields: Record<string, unknown>;
  last_synced_at: string;
};

function text(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.name || object.id || JSON.stringify(object));
  }
  return String(value);
}

function money(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  const number = Number.isFinite(parsed) ? parsed : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
}

function fmtDate(value: unknown) {
  const raw = text(value);
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return `/vouchers?${search.toString()}`;
}

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const sp = await searchParams;
  const q = sp.q || '';
  const status = sp.status || '';

  const params: unknown[] = [VOUCHERS_TABLE_ID];
  const where = ['table_id = $1'];

  if (q) {
    params.push(`%${q}%`);
    where.push(`searchable_text ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`COALESCE(raw_fields->>'Status', '') = $${params.length}`);
  }

  const [records, summary, statuses] = await Promise.all([
    query<VoucherRecord>(`
      SELECT record_id, raw_fields, last_synced_at
      FROM airtable_records
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(raw_fields->>'Accrue', raw_fields->>'Placed', '') DESC, COALESCE(raw_fields->>'Voucher', record_id)
      LIMIT 250
    `, params),
    query<{
      count: string;
      debit: string;
      credit: string;
      balance: string;
      open_balance: string;
    }>(`
      SELECT
        COUNT(*)::text as count,
        COALESCE(SUM(CASE WHEN COALESCE(raw_fields->>'Debit', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$' THEN REPLACE(raw_fields->>'Debit', ',', '')::numeric ELSE 0 END), 0)::text as debit,
        COALESCE(SUM(CASE WHEN COALESCE(raw_fields->>'Credit', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$' THEN REPLACE(raw_fields->>'Credit', ',', '')::numeric ELSE 0 END), 0)::text as credit,
        COALESCE(SUM(CASE WHEN COALESCE(raw_fields->>'Balance', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$' THEN REPLACE(raw_fields->>'Balance', ',', '')::numeric ELSE 0 END), 0)::text as balance,
        COALESCE(SUM(CASE
          WHEN COALESCE(raw_fields->>'Balance', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$'
            AND ABS(REPLACE(raw_fields->>'Balance', ',', '')::numeric) > 0.01
            THEN REPLACE(raw_fields->>'Balance', ',', '')::numeric
          ELSE 0
        END), 0)::text as open_balance
      FROM airtable_records
      WHERE table_id = $1
    `, [VOUCHERS_TABLE_ID]),
    query<{
      status: string;
      count: string;
    }>(`
      SELECT COALESCE(NULLIF(raw_fields->>'Status', ''), 'No Status') as status, COUNT(*)::text as count
      FROM airtable_records
      WHERE table_id = $1
      GROUP BY 1
      ORDER BY count DESC, status
    `, [VOUCHERS_TABLE_ID]),
  ]);

  const totals = summary[0];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Vouchers</h1>
          <p className="text-brand-sage/60 text-sm">
            Invoice, payment, and document records from the Airtable Vouchers table.
          </p>
        </div>
        <Link href="/data-explorer?table=tblUYAd8KBsZi97Pu" className="btn-secondary text-sm">
          Open Vouchers in Data Explorer
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Vouchers', value: Number(totals?.count || 0).toLocaleString(), icon: ClipboardList, tone: 'text-brand-cream' },
          { label: 'Debit Total', value: money(totals?.debit), icon: DollarSign, tone: 'text-brand-gold' },
          { label: 'Credit Total', value: money(totals?.credit), icon: TrendingUp, tone: 'text-brand-sage' },
          { label: 'Net Balance', value: money(totals?.balance), icon: DollarSign, tone: 'text-brand-cream' },
          { label: 'Open Balance', value: money(totals?.open_balance), icon: FileText, tone: 'text-brand-gold' },
        ].map(item => (
          <div key={item.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="label">{item.label}</span>
              <item.icon size={14} className="text-brand-sage" />
            </div>
            <span className={`font-mono text-base font-semibold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>

      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-brand-dark rounded border border-brand-green/20 max-w-full overflow-x-auto">
            <Link
              href={buildHref({ q })}
              className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${!status ? 'bg-brand-midgreen text-white' : 'text-brand-warm/65 hover:text-brand-cream'}`}
            >
              All
            </Link>
            {statuses.map(row => (
              <Link
                key={row.status}
                href={buildHref({ status: row.status === 'No Status' ? undefined : row.status, q })}
                className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${
                  status === row.status ? 'bg-brand-midgreen text-white' : 'text-brand-warm/65 hover:text-brand-cream'
                }`}
              >
                {row.status} ({Number(row.count).toLocaleString()})
              </Link>
            ))}
          </div>
        </div>

        <form method="GET" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/45" />
            <input name="q" defaultValue={q} placeholder="Search voucher, PO, check, customer, folio..." className="input h-8 pl-8 text-xs" />
          </div>
          <button type="submit" className="btn-primary h-8 px-3 text-xs">Search</button>
          {(q || status) && <Link href="/vouchers" className="text-xs text-brand-sage/60 hover:text-brand-sage">Clear</Link>}
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Status</th>
                <th>Issued / Customer</th>
                <th>Form</th>
                <th>Folio</th>
                <th>Ref 1</th>
                <th>Ref 2</th>
                <th>Accrue</th>
                <th>Cleared</th>
                <th>Check #</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
                <th>Memo / Via</th>
                <th>Raw</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-12 text-brand-sage/40">No vouchers match this filter.</td></tr>
              ) : records.map(record => {
                const f = record.raw_fields;
                const rowStatus = text(f.Status);
                return (
                  <tr key={record.record_id}>
                    <td>
                      <div className="font-mono font-semibold text-brand-sage">{text(f.Voucher) || record.record_id}</div>
                      {text(f.ID) && <div className="text-[10px] text-brand-warm/40">ID {text(f.ID)}</div>}
                    </td>
                    <td><span className={rowStatus.toLowerCase().includes('void') || rowStatus.toLowerCase().includes('cancel') ? 'badge-red' : rowStatus.toLowerCase().includes('paid') || rowStatus.toLowerCase().includes('clear') ? 'badge-green' : 'badge-gold'}>{rowStatus || 'No Status'}</span></td>
                    <td className="max-w-56 truncate">{text(f.Issued || f.Co || f.Perform)}</td>
                    <td>{text(f['Form Title'] || f.Form)}</td>
                    <td className="font-mono text-brand-warm/65">{text(f.Folio || f['Folio Link'])}</td>
                    <td>{text(f['Reference 1'])}</td>
                    <td>{text(f['Reference 2'])}</td>
                    <td>{fmtDate(f.Accrue)}</td>
                    <td>{fmtDate(f.Cleared)}</td>
                    <td className="font-mono text-brand-warm/65">{text(f['CK#'])}</td>
                    <td className="text-right font-mono">{money(f.Debit)}</td>
                    <td className="text-right font-mono text-brand-sage">{money(f.Credit)}</td>
                    <td className={`text-right font-mono font-semibold ${Number(String(f.Balance || '').replace(/[$,]/g, '')) > 0 ? 'text-brand-gold' : 'text-brand-warm/65'}`}>{money(f.Balance)}</td>
                    <td className="max-w-xs truncate text-brand-warm/55">{text(f['Via Free Entry'] || f.Resource || f['Tracking #'])}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer text-brand-sage/70 text-xs">Fields</summary>
                        <pre className="mt-2 max-w-xl overflow-auto rounded bg-brand-dark p-3 text-[10px] text-brand-warm/70">{JSON.stringify(f, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
