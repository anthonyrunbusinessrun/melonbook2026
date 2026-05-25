export const dynamic = 'force-dynamic';
import { getTablePage, fieldValue, TABLES } from '@/lib/airtable-direct';
import { BarChart3 } from 'lucide-react';

function fmt(n: unknown) {
  if (typeof n !== 'number') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default async function AccountsPage() {
  let records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}> = [];
  let error = '';
  try {
    const data = await getTablePage(TABLES.accounts, {
      pageSize: 100,
      sort: [{ field: 'No', direction: 'asc' }],
    });
    records = data.records;
  } catch (e) { error = (e as Error).message; }

  const totalDebits = records.reduce((s, r) => s + (typeof r.fields['Debits'] === 'number' ? r.fields['Debits'] as number : 0), 0);
  const totalCredits = records.reduce((s, r) => s + (typeof r.fields['Credits'] === 'number' ? r.fields['Credits'] as number : 0), 0);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2">
          <BarChart3 size={24} /> Chart of Accounts
        </h1>
        <p className="text-brand-sage/60 text-sm">General ledger accounts · Melonbook™ 2026</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><div className="label">Total Accounts</div><div className="text-2xl font-bold text-brand-cream">{records.length}</div></div>
        <div className="stat-card"><div className="label">Total Debits</div><div className="text-xl font-bold text-brand-gold font-mono">{fmt(totalDebits)}</div></div>
        <div className="stat-card"><div className="label">Total Credits</div><div className="text-xl font-bold text-brand-sage font-mono">{fmt(totalCredits)}</div></div>
      </div>

      {error && <div className="card p-3 text-brand-brightred text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-dark/40 border-b border-brand-green/20">
              {['Acct Code','No','Title','Type','Debits','Credits','Balance'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-brand-sage/60 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((rec, i) => {
              const f = rec.fields;
              const bal = typeof f['Balance'] === 'number' ? f['Balance'] as number : null;
              return (
                <tr key={rec.id} className={`table-row-hover border-b border-brand-green/10 ${i % 2 === 1 ? 'bg-brand-dark/10' : ''}`}>
                  <td className="px-4 py-3 font-mono text-brand-gold font-semibold">{fieldValue(f['Acct Code'])}</td>
                  <td className="px-4 py-3 font-mono text-brand-cream/80">{String(f['No'] || '')}</td>
                  <td className="px-4 py-3 text-brand-cream font-medium">{String(f['Title'] || '')}</td>
                  <td className="px-4 py-3"><span className="badge badge-gray text-xs">{fieldValue(f['Acct Type'])}</span></td>
                  <td className="px-4 py-3 font-mono text-right text-brand-gold">{fmt(f['Debits'])}</td>
                  <td className="px-4 py-3 font-mono text-right text-brand-sage">{fmt(f['Credits'])}</td>
                  <td className={`px-4 py-3 font-mono text-right font-semibold ${bal !== null && bal >= 0 ? 'text-brand-cream' : 'text-brand-brightred'}`}>
                    {fmt(f['Balance'])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
