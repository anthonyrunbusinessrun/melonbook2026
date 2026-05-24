export const dynamic = 'force-dynamic';
import { getTablePage, fieldValue, fmtCurrency, fmtDate, TABLES } from '@/lib/airtable-direct';
import Link from 'next/link';
import { Search, RefreshCw, Download, TrendingUp, TrendingDown } from 'lucide-react';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; acct?: string; page?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.q || '';
  const acctFilter = sp.acct || '';
  const offset = sp.offset || undefined;

  let filterFormula = '';
  const filters: string[] = [];
  if (search) filters.push(`OR(FIND("${search.toUpperCase()}",UPPER({Trans #})),FIND("${search.toUpperCase()}",UPPER({Memo})),FIND("${search.toUpperCase()}",UPPER(ARRAYJOIN({Acct Name}))))`);
  if (acctFilter) filters.push(`ARRAYJOIN({Acct Name})="${acctFilter}"`);
  if (filters.length) filterFormula = filters.length > 1 ? `AND(${filters.join(',')})` : filters[0];

  let data;
  let error = '';
  try {
    data = await getTablePage(TABLES.transactions, {
      pageSize: 100,
      offset,
      filterFormula: filterFormula || undefined,
      sort: [{ field: 'ID', direction: 'desc' }],
    });
  } catch (e) {
    error = (e as Error).message;
    data = { records: [], offset: undefined };
  }

  const records = data?.records || [];
  const nextOffset = data?.offset;

  // Compute totals for visible page
  let totalDebit = 0, totalCredit = 0;
  records.forEach(r => {
    const d = r.fields['Debit'];
    const c = r.fields['Credit'];
    if (typeof d === 'number') totalDebit += d;
    if (typeof c === 'number') totalCredit += c;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Transactions</h1>
          <p className="text-brand-sage/60 text-sm">
            30,688 ledger entries · Live from Melonbook™ 2026 Airtable · Double-entry accounting
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/ar/export" className="btn-gold flex items-center gap-1.5 text-sm">
            <Download size={13} /> Export Excel
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="label">Total Records</div>
          <div className="text-2xl font-bold text-brand-cream font-mono">30,688</div>
          <div className="text-xs text-brand-sage/50">All ledger entries</div>
        </div>
        <div className="stat-card">
          <div className="label flex items-center gap-1"><TrendingUp size={11} /> Page Debits</div>
          <div className="text-xl font-bold text-brand-cream font-mono">{fmtCurrency(totalDebit)}</div>
        </div>
        <div className="stat-card">
          <div className="label flex items-center gap-1"><TrendingDown size={11} /> Page Credits</div>
          <div className="text-xl font-bold text-brand-cream font-mono">{fmtCurrency(totalCredit)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Page Balance</div>
          <div className={`text-xl font-bold font-mono ${totalDebit - totalCredit >= 0 ? 'text-brand-sage' : 'text-brand-brightred'}`}>
            {fmtCurrency(totalDebit - totalCredit)}
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <form className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
          <input name="q" defaultValue={search} placeholder="Search Trans #, Account, Memo..." className="input pl-8 text-sm py-1.5 w-full" />
        </div>
        <select name="acct" defaultValue={acctFilter} className="select text-sm py-1.5 w-40">
          <option value="">All Accounts</option>
          <option value="Accounts Receivable">1152 - A/R</option>
          <option value="UNDEPOSITED FUNDS">1122 - Undeposited</option>
          <option value="Freight Cost Watermelons">1710 - Freight</option>
          <option value="Sales - Watermelons">1610 - Sales</option>
          <option value="Accounts Payable">1310 - A/P</option>
        </select>
        <button type="submit" className="btn-secondary text-sm py-1.5 flex items-center gap-1.5">
          <RefreshCw size={12} /> Filter
        </button>
        {(search || acctFilter) && (
          <Link href="/transactions" className="text-brand-sage/60 text-sm hover:text-brand-cream">Clear</Link>
        )}
      </form>

      {error && (
        <div className="card p-4 border-brand-brightred/30">
          <p className="text-brand-brightred text-sm">⚠ Airtable error: {error}</p>
          <p className="text-brand-sage/60 text-xs mt-1">Check AIRTABLE_API_KEY environment variable.</p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-dark/40 border-b border-brand-green/20">
                {['Trans #','Accrue','Account','Acct Name','D/C','Folio','Issued','Ref 1','Memo','Debit','Credit'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-brand-sage/60 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && !error ? (
                <tr><td colSpan={11} className="text-center py-12 text-brand-sage/40">
                  <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
                  Loading from Airtable…
                </td></tr>
              ) : records.map((rec, i) => {
                const f = rec.fields;
                const transNo = String(f['Trans #'] || '');
                const isDebit = transNo.startsWith('DR');
                const isCredit = transNo.startsWith('CR');
                const debit = typeof f['Debit'] === 'number' ? f['Debit'] : null;
                const credit = typeof f['Credit'] === 'number' ? f['Credit'] : null;
                return (
                  <tr key={rec.id} className={`table-row-hover border-b border-brand-green/10 ${i % 2 === 1 ? 'bg-brand-dark/10' : ''}`}>
                    <td className={`px-3 py-2 font-mono text-xs whitespace-nowrap font-medium ${isDebit ? 'text-brand-gold' : isCredit ? 'text-brand-sage' : 'text-brand-cream'}`}>
                      {transNo}
                    </td>
                    <td className="px-3 py-2 text-brand-sage/70 whitespace-nowrap">{fmtDate(fieldValue(f['Accrue']))}</td>
                    <td className="px-3 py-2 font-mono text-brand-cream/80 whitespace-nowrap">{fieldValue(f['Acct'])}</td>
                    <td className="px-3 py-2 text-brand-cream/70 whitespace-nowrap max-w-[140px] truncate">{fieldValue(f['Acct Name'])}</td>
                    <td className="px-3 py-2">
                      <span className={`badge text-[10px] ${fieldValue(f['Df']) === 'Dr' ? 'badge-gold' : 'badge-green'}`}>
                        {fieldValue(f['Df'])}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-brand-sage/60 whitespace-nowrap">{fieldValue(f['Folio'])}</td>
                    <td className="px-3 py-2 text-brand-sage/60 whitespace-nowrap">{fmtDate(fieldValue(f['Issued']))}</td>
                    <td className="px-3 py-2 text-brand-cream/60 whitespace-nowrap max-w-[100px] truncate">{fieldValue(f['Ref 1'])}</td>
                    <td className="px-3 py-2 text-brand-cream/60 max-w-[120px] truncate">{String(f['Memo'] || '')}</td>
                    <td className={`px-3 py-2 font-mono whitespace-nowrap text-right ${debit ? 'text-brand-gold' : 'text-brand-sage/30'}`}>
                      {debit ? fmtCurrency(debit) : '—'}
                    </td>
                    <td className={`px-3 py-2 font-mono whitespace-nowrap text-right ${credit ? 'text-brand-sage' : 'text-brand-sage/30'}`}>
                      {credit ? fmtCurrency(credit) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-brand-green/20 flex items-center justify-between">
          <span className="text-xs text-brand-sage/60">
            Showing {records.length} records {search || acctFilter ? '(filtered)' : ''}
          </span>
          <div className="flex gap-2">
            {offset && (
              <Link
                href={`/transactions?offset=${offset}${search ? `&q=${search}` : ''}${acctFilter ? `&acct=${encodeURIComponent(acctFilter)}` : ''}`}
                className="btn-secondary text-xs py-1.5"
              >
                Next Page →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
