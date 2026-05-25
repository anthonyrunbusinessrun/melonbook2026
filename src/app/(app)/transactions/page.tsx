export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Download, RefreshCw, Search, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { query } from '@/db';

const TRANSACTIONS_TABLE_ID = 'tblfNYrQKvtOwslbr';

type TransactionMirrorRecord = {
  record_id: string;
  raw_fields: Record<string, unknown>;
  last_synced_at: string;
};

type SummaryRow = {
  count: string;
  debit: string;
  credit: string;
  last_synced_at: string | null;
};

function text(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.name || object.code || object.id || JSON.stringify(object));
  }
  return String(value);
}

function number(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number(value));
}

function fmtDate(value: unknown) {
  const raw = text(value);
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function buildHref(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value) !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return `/transactions${qs ? `?${qs}` : ''}`;
}

function accountWhere(acctFilter: string, nextParam: number) {
  const accountNames: Record<string, string[]> = {
    '1152': ['Accounts Receivable'],
    '1122': ['UNDEPOSITED FUNDS', 'Undeposited Funds'],
    '1610': ['Sales - Watermelons', 'Sales Watermelons'],
    '1710': ['Freight Cost Watermelons', 'Freight'],
    '1310': ['Accounts Payable'],
  };

  const pieces = [
    `COALESCE(raw_fields->>'Acct', '') ILIKE $${nextParam}`,
    `COALESCE(raw_fields->>'Trans #', '') ILIKE $${nextParam}`,
  ];

  const names = accountNames[acctFilter] || [];
  names.forEach((_, index) => {
    pieces.push(`COALESCE(raw_fields->>'Acct Name', '') ILIKE $${nextParam + index + 1}`);
  });

  return {
    sql: `(${pieces.join(' OR ')})`,
    values: [`%${acctFilter}%`, ...names.map(name => `%${name}%`)],
  };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; acct?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q || '';
  const acctFilter = sp.acct || '';
  const page = Math.max(1, Number(sp.page || 1));
  const limit = 100;
  const offset = (page - 1) * limit;

  const params: unknown[] = [TRANSACTIONS_TABLE_ID];
  const where = ['table_id = $1'];

  if (q) {
    params.push(`%${q}%`);
    where.push(`searchable_text ILIKE $${params.length}`);
  }

  if (acctFilter) {
    const account = accountWhere(acctFilter, params.length + 1);
    where.push(account.sql);
    params.push(...account.values);
  }

  const whereSql = where.join(' AND ');

  const [records, countRows, summaryRows, accountRows] = await Promise.all([
    query<TransactionMirrorRecord>(`
      SELECT record_id, raw_fields, last_synced_at::text as last_synced_at
      FROM airtable_records
      WHERE ${whereSql}
      ORDER BY
        COALESCE(raw_fields->>'Accrue', raw_fields->>'Issued', '') DESC,
        COALESCE(raw_fields->>'ID', raw_fields->>'Trans #', record_id) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]),
    query<{ count: string }>(`
      SELECT COUNT(*)::text as count
      FROM airtable_records
      WHERE ${whereSql}
    `, params),
    query<SummaryRow>(`
      SELECT
        COUNT(*)::text as count,
        COALESCE(SUM(CASE
          WHEN COALESCE(raw_fields->>'Debit', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$'
            THEN REPLACE(raw_fields->>'Debit', ',', '')::numeric
          ELSE 0
        END), 0)::text as debit,
        COALESCE(SUM(CASE
          WHEN COALESCE(raw_fields->>'Credit', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$'
            THEN REPLACE(raw_fields->>'Credit', ',', '')::numeric
          ELSE 0
        END), 0)::text as credit,
        MAX(last_synced_at)::text as last_synced_at
      FROM airtable_records
      WHERE table_id = $1
    `, [TRANSACTIONS_TABLE_ID]),
    query<{ account: string; count: string }>(`
      SELECT account, COUNT(*)::text as count
      FROM (
        SELECT
          CASE
            WHEN COALESCE(raw_fields->>'Acct', '') ILIKE '%1152%' OR COALESCE(raw_fields->>'Acct Name', '') ILIKE '%Accounts Receivable%' THEN '1152'
            WHEN COALESCE(raw_fields->>'Acct', '') ILIKE '%1122%' OR COALESCE(raw_fields->>'Acct Name', '') ILIKE '%UNDEPOSITED%' THEN '1122'
            WHEN COALESCE(raw_fields->>'Acct', '') ILIKE '%1610%' OR COALESCE(raw_fields->>'Acct Name', '') ILIKE '%Sales%' THEN '1610'
            WHEN COALESCE(raw_fields->>'Acct', '') ILIKE '%1710%' OR COALESCE(raw_fields->>'Acct Name', '') ILIKE '%Freight%' THEN '1710'
            WHEN COALESCE(raw_fields->>'Acct', '') ILIKE '%1310%' OR COALESCE(raw_fields->>'Acct Name', '') ILIKE '%Accounts Payable%' THEN '1310'
            ELSE NULL
          END as account
        FROM airtable_records
        WHERE table_id = $1
      ) parsed
      WHERE account IS NOT NULL
      GROUP BY account
      ORDER BY account
    `, [TRANSACTIONS_TABLE_ID]),
  ]);

  const total = Number(countRows[0]?.count || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const summary = summaryRows[0];
  const accountCounts = new Map(accountRows.map(row => [row.account, Number(row.count || 0)]));
  const allDebit = number(summary?.debit);
  const allCredit = number(summary?.credit);
  const pageDebit = records.reduce((sum, record) => sum + number(record.raw_fields.Debit), 0);
  const pageCredit = records.reduce((sum, record) => sum + number(record.raw_fields.Credit), 0);

  const accountFilters = [
    { no: '', label: 'All Accounts', count: Number(summary?.count || 0) },
    { no: '1152', label: 'AR 1152', count: accountCounts.get('1152') || 0 },
    { no: '1122', label: 'Payments 1122', count: accountCounts.get('1122') || 0 },
    { no: '1610', label: 'Sales 1610', count: accountCounts.get('1610') || 0 },
    { no: '1710', label: 'Freight 1710', count: accountCounts.get('1710') || 0 },
    { no: '1310', label: 'AP 1310', count: accountCounts.get('1310') || 0 },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Transactions</h1>
          <p className="text-brand-sage/60 text-sm">
            {total.toLocaleString()} filtered ledger rows · {Number(summary?.count || 0).toLocaleString()} synced from Airtable into PostgreSQL
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sync" className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} /> Sync Center
          </Link>
          <a href="/api/ar/export" className="btn-gold flex items-center gap-1.5 text-sm">
            <Download size={13} /> Export AR Excel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: 'Synced Transactions', value: Number(summary?.count || 0).toLocaleString(), sub: `Last sync ${summary?.last_synced_at ? new Date(summary.last_synced_at).toLocaleString() : 'never'}` },
          { label: 'All Debits', value: money(allDebit), sub: 'PostgreSQL mirror total', tone: 'text-brand-gold' },
          { label: 'All Credits', value: money(allCredit), sub: 'PostgreSQL mirror total', tone: 'text-brand-sage' },
          { label: 'Page Debits', value: money(pageDebit), sub: 'Visible rows only', tone: 'text-brand-gold' },
          { label: 'Page Credits', value: money(pageCredit), sub: 'Visible rows only', tone: 'text-brand-sage' },
        ].map(item => (
          <div key={item.label} className="stat-card">
            <div className="label">{item.label}</div>
            <div className={`text-base font-semibold font-mono ${item.tone || 'text-brand-cream'}`}>{item.value}</div>
            <div className="text-[10px] text-brand-sage/45 truncate">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {accountFilters.map(filter => (
            <Link
              key={filter.no || 'all'}
              href={buildHref({ q, acct: filter.no || undefined })}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                acctFilter === filter.no ? 'bg-brand-midgreen text-white' : 'bg-brand-dark border border-brand-green/20 text-brand-warm/65 hover:text-brand-cream'
              }`}
            >
              {filter.label} <span className="text-[10px] opacity-70">({filter.count.toLocaleString()})</span>
            </Link>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-3 flex-wrap">
          {acctFilter && <input type="hidden" name="acct" value={acctFilter} />}
          <div className="relative flex-1 min-w-64 max-w-xl">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search Trans #, account, memo, voucher, folio, reference..."
              className="input h-9 pl-8 text-xs"
            />
          </div>
          <button type="submit" className="btn-primary h-9 px-3 text-xs inline-flex items-center gap-1.5">
            <SlidersHorizontal size={13} /> Filter
          </button>
          {(q || acctFilter) && <Link href="/transactions" className="text-xs text-brand-sage/60 hover:text-brand-sage">Clear</Link>}
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                {['Trans #', 'Accrue', 'Account', 'Acct Name', 'D/C', 'Voucher', 'Folio', 'Issued', 'Ref 1', 'Ref 2', 'Memo', 'Debit', 'Credit', 'Raw'].map(header => (
                  <th key={header} className={header === 'Debit' || header === 'Credit' ? 'text-right' : ''}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-brand-sage/40">
                    No transactions match this filter. The Airtable mirror currently has {Number(summary?.count || 0).toLocaleString()} transaction records.
                  </td>
                </tr>
              ) : records.map(record => {
                const f = record.raw_fields;
                const transNo = text(f['Trans #']);
                const debit = number(f.Debit);
                const credit = number(f.Credit);
                const dc = text(f.Df || f['D/C']);

                return (
                  <tr key={record.record_id}>
                    <td className="font-mono font-semibold text-brand-sage whitespace-nowrap">{transNo || record.record_id}</td>
                    <td className="whitespace-nowrap">{fmtDate(f.Accrue)}</td>
                    <td className="font-mono text-brand-warm/75 whitespace-nowrap">{text(f.Acct)}</td>
                    <td className="max-w-56 truncate">{text(f['Acct Name'])}</td>
                    <td>
                      <span className={dc.toLowerCase().startsWith('dr') || transNo.startsWith('DR') ? 'badge-gold' : 'badge-green'}>
                        {dc || (transNo.startsWith('DR') ? 'Dr' : transNo.startsWith('CR') ? 'Cr' : '—')}
                      </span>
                    </td>
                    <td className="font-mono text-brand-warm/65 whitespace-nowrap">{text(f.Voucher)}</td>
                    <td className="font-mono text-brand-warm/65 whitespace-nowrap">{text(f.Folio || f['Folio Link'])}</td>
                    <td className="whitespace-nowrap">{fmtDate(f.Issued)}</td>
                    <td className="max-w-40 truncate">{text(f['Ref 1'])}</td>
                    <td className="max-w-40 truncate">{text(f['Ref 2'])}</td>
                    <td className="max-w-64 truncate text-brand-warm/60">{text(f.Memo)}</td>
                    <td className="text-right font-mono text-brand-gold whitespace-nowrap">{debit ? money(debit) : '—'}</td>
                    <td className="text-right font-mono text-brand-sage whitespace-nowrap">{credit ? money(credit) : '—'}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer text-xs text-brand-sage/70 hover:text-brand-sage">View</summary>
                        <pre className="mt-2 max-w-xl overflow-auto rounded bg-brand-dark p-3 text-[10px] text-brand-warm/70">{JSON.stringify(f, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-brand-green/20 flex items-center justify-between text-xs text-brand-warm/60">
          <span>Showing {records.length ? offset + 1 : 0}-{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={buildHref({ q, acct: acctFilter, page: page - 1 })} className="btn-secondary py-1 text-xs">
                Previous
              </Link>
            )}
            <span className="text-brand-sage/50">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link href={buildHref({ q, acct: acctFilter, page: page + 1 })} className="btn-secondary py-1 text-xs">
                Next
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="card p-4 border-brand-gold/20">
        <div className="flex items-center gap-2 text-brand-gold text-sm font-semibold">
          <TrendingUp size={14} />
          Encoder automation note
        </div>
        <p className="text-xs text-brand-sage/65 mt-1">
          This page reads the synced PostgreSQL mirror, so accounting staff can search and filter the full Airtable Transactions table without waiting on Airtable views. Use AR Input for spreadsheet-style receivable entry and Encoder Station for guided journal templates.
        </p>
      </div>
    </div>
  );
}
