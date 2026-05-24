export const dynamic = 'force-dynamic';
import { getTablePage, fieldValue, fmtDate, TABLES } from '@/lib/airtable-direct';
import { Search, FileText } from 'lucide-react';
import Link from 'next/link';

export default async function VouchersPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; status?: string; offset?: string }> }) {
  const sp = await searchParams;
  const search = sp.q || '';
  const statusFilter = sp.status || '';
  const offset = sp.offset || undefined;

  const filters: string[] = [];
  if (search) filters.push(`OR(FIND("${search.toUpperCase()}",UPPER({Voucher})),FIND("${search.toUpperCase()}",UPPER({Reference 1})))`);
  if (statusFilter) filters.push(`{Status}="${statusFilter}"`);
  const filterFormula = filters.length > 1 ? `AND(${filters.join(',')})` : filters[0];

  let data: { records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}>; offset?: string } = { records: [] };
  let error = '';
  try {
    data = await getTablePage(TABLES.vouchers, {
      pageSize: 100, offset,
      filterFormula: filterFormula || undefined,
      sort: [{ field: 'ID', direction: 'desc' }],
    });
  } catch (e) { error = (e as Error).message; }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2">
            <FileText size={24} /> Vouchers
          </h1>
          <p className="text-brand-sage/60 text-sm">14,216 vouchers · Live from Airtable</p>
        </div>
      </div>

      <form className="card p-3 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
          <input name="q" defaultValue={search} placeholder="Search voucher or reference..." className="input pl-8 text-sm py-1.5 w-full" />
        </div>
        <select name="status" defaultValue={statusFilter} className="select text-sm py-1.5 w-40">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
          <option value="Void">Void</option>
        </select>
        <button type="submit" className="btn-secondary text-sm py-1.5">Filter</button>
        {(search || statusFilter) && <Link href="/vouchers" className="text-brand-sage/60 text-sm hover:text-brand-cream self-center">Clear</Link>}
      </form>

      {error && <div className="card p-3 text-brand-brightred text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-dark/40 border-b border-brand-green/20">
              {['Voucher','Status','Folio','Accrue','Placed','Ref 1','Ref 2','Debit','Credit','Balance'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-brand-sage/60 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.records.map((rec, i) => {
              const f = rec.fields;
              const bal = typeof f['Balance'] === 'number' ? f['Balance'] as number : null;
              const fmt = (n: unknown) => typeof n === 'number' ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n) : '—';
              return (
                <tr key={rec.id} className={`table-row-hover border-b border-brand-green/10 ${i % 2 === 1 ? 'bg-brand-dark/10' : ''}`}>
                  <td className="px-3 py-2 font-mono text-brand-gold font-medium whitespace-nowrap">{fieldValue(f['Voucher'])}</td>
                  <td className="px-3 py-2">
                    {!!f['Status'] && <span className={`badge text-[10px] ${fieldValue(f['Status']) === 'Active' ? 'badge-green' : 'badge-gray'}`}>{fieldValue(f['Status'])}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-brand-sage/60 whitespace-nowrap">{fieldValue(f['Folio'])}</td>
                  <td className="px-3 py-2 text-brand-sage/60 whitespace-nowrap">{fmtDate(fieldValue(f['Accrue']))}</td>
                  <td className="px-3 py-2 text-brand-sage/60 whitespace-nowrap">{fmtDate(fieldValue(f['Placed']))}</td>
                  <td className="px-3 py-2 text-brand-cream/60 max-w-[120px] truncate">{String(f['Reference 1'] || '')}</td>
                  <td className="px-3 py-2 text-brand-cream/60 max-w-[100px] truncate">{String(f['Reference 2'] || '')}</td>
                  <td className="px-3 py-2 font-mono text-right text-brand-gold">{fmt(f['Debit'])}</td>
                  <td className="px-3 py-2 font-mono text-right text-brand-sage">{fmt(f['Credit'])}</td>
                  <td className={`px-3 py-2 font-mono text-right font-medium ${bal !== null && bal < 0 ? 'text-brand-brightred' : 'text-brand-cream/80'}`}>{fmt(f['Balance'])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-brand-green/20 flex justify-between items-center">
          <span className="text-xs text-brand-sage/60">{data.records.length} vouchers shown</span>
          {data.offset && <Link href={`/vouchers?offset=${data.offset}${search?`&q=${search}`:''}${statusFilter?`&status=${statusFilter}`:''}`} className="btn-secondary text-xs py-1.5">Next →</Link>}
        </div>
      </div>
    </div>
  );
}
