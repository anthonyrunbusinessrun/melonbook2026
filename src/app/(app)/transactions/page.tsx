import { query } from '@/db';
import { Search, SlidersHorizontal } from 'lucide-react';

function fmt(n: number | null) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; acct?: string; page?: string }>
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page || '1');
  const limit = 100;
  const offset = (page - 1) * limit;
  const search = sp.q || '';
  const acctFilter = sp.acct || '';

  const whereClauses = ['t.deleted_at IS NULL'];
  const params: unknown[] = [];
  let pi = 1;

  if (search) {
    whereClauses.push(`(t.trans_no ILIKE $${pi} OR t.memo ILIKE $${pi} OR t.ref1 ILIKE $${pi} OR t.account_name ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }
  if (acctFilter) {
    whereClauses.push(`t.account_no = $${pi}`);
    params.push(parseInt(acctFilter));
    pi++;
  }

  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [transactions, [countRow]] = await Promise.all([
    query<{
      id: string; trans_no: string; account_no: number; account_name: string;
      debit: number; credit: number; memo: string; ref1: string; ref2: string;
      accrue_date: string; voucher_code: string; folio_ref: string;
    }>(
      `SELECT t.id, t.trans_no, t.account_no, t.account_name,
         t.debit, t.credit, t.memo, t.ref1, t.ref2,
         t.accrue_date, t.voucher_code, t.folio_ref
       FROM transactions t
       ${whereStr}
       ORDER BY t.accrue_date DESC NULLS LAST, t.id DESC
       LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, limit, offset]
    ),
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions t ${whereStr}`,
      params
    ),
  ]);

  const total = Number(countRow?.count || 0);
  const totalPages = Math.ceil(total / limit);

  // Get account list for filter
  const accounts = await query<{ acct_no: number; title: string; count: number }>(
    `SELECT a.acct_no, a.title, COUNT(t.id) as count
     FROM accounts a JOIN transactions t ON t.account_id = a.id
     WHERE a.acct_no IN (1152, 1122, 1710, 1610, 1310)
     GROUP BY a.acct_no, a.title ORDER BY a.acct_no`
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Transactions</h1>
          <p className="text-brand-sage/60 text-sm">
            {total.toLocaleString()} ledger entries · Double-entry from Melonbook™ 2026
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex items-center gap-4 flex-wrap">
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search trans #, memo, ref..."
              className="input pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-brand-sage/60" />
            <select name="acct" defaultValue={acctFilter} className="select h-8 text-xs w-52">
              <option value="">All Accounts</option>
              {accounts.map(a => (
                <option key={a.acct_no} value={a.acct_no}>
                  {a.acct_no} — {a.title} ({Number(a.count).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary h-8 px-3 text-xs">Filter</button>
          {(search || acctFilter) && (
            <a href="/transactions" className="text-xs text-brand-sage/50 hover:text-brand-sage">Clear</a>
          )}
        </form>
        <div className="text-xs text-brand-sage/40">
          Page {page} of {totalPages}
        </div>
      </div>

      {/* Account quick filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { no: '', label: 'All' },
          { no: '1152', label: 'AR (1152)' },
          { no: '1122', label: 'Undeposited (1122)' },
          { no: '1610', label: 'Sales (1610)' },
          { no: '1710', label: 'Freight (1710)' },
          { no: '1310', label: 'AP (1310)' },
        ].map(f => (
          <a
            key={f.no}
            href={`/transactions?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(f.no ? { acct: f.no } : {}) }).toString()}`}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${acctFilter === f.no ? 'bg-brand-midgreen text-white' : 'bg-brand-forest border border-brand-green/20 text-brand-warm/60 hover:text-brand-cream'}`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Transactions table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Trans #</th>
                <th>Date</th>
                <th>Account</th>
                <th>Voucher</th>
                <th>Folio / Lot</th>
                <th>Ref 1</th>
                <th>Ref 2</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-brand-sage/40">
                    {search || acctFilter ? 'No transactions match your filters' : 'No transactions found — run initial sync'}
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id}>
                    <td className="font-mono text-brand-sage text-xs">{t.trans_no}</td>
                    <td>{t.accrue_date ? new Date(t.accrue_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'}</td>
                    <td>
                      <span className={`text-xs ${t.account_no === 1152 ? 'text-brand-gold' : t.account_no === 1122 ? 'text-brand-sage' : 'text-brand-warm/70'}`}>
                        {t.account_no && <code className="font-mono">{t.account_no}</code>}
                        {t.account_name && <span className="ml-1 text-brand-warm/50">{t.account_name}</span>}
                      </span>
                    </td>
                    <td className="font-mono text-brand-warm/60">{t.voucher_code}</td>
                    <td className="font-mono text-brand-warm/60">{t.folio_ref}</td>
                    <td className="text-brand-warm/70">{t.ref1}</td>
                    <td className="text-brand-warm/50">{t.ref2}</td>
                    <td className="text-right">{t.debit ? <span className="money">{fmt(t.debit)}</span> : <span className="text-brand-warm/20">—</span>}</td>
                    <td className="text-right">{t.credit ? <span className="money-positive">{fmt(t.credit)}</span> : <span className="text-brand-warm/20">—</span>}</td>
                    <td className="text-brand-warm/50 max-w-xs truncate">{t.memo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-brand-green/20 flex items-center justify-between text-xs text-brand-warm/60">
            <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a href={`/transactions?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(acctFilter ? { acct: acctFilter } : {}), page: (page - 1).toString() })}`}
                  className="btn-secondary py-1 text-xs">← Prev</a>
              )}
              {page < totalPages && (
                <a href={`/transactions?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(acctFilter ? { acct: acctFilter } : {}), page: (page + 1).toString() })}`}
                  className="btn-secondary py-1 text-xs">Next →</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
