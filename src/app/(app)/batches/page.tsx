export const dynamic = 'force-dynamic';
import { getTablePage, fieldValue, TABLES } from '@/lib/airtable-direct';
import { Package } from 'lucide-react';

export default async function BatchesPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; offset?: string }> }) {
  const sp = await searchParams;
  const offset = sp.offset || undefined;
  const search = sp.q || '';

  let data: { records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}>; offset?: string } = { records: [] };
  let error = '';
  try {
    data = await getTablePage(TABLES.batches, {
      pageSize: 100, offset,
      filterFormula: search ? `OR(FIND("${search.toUpperCase()}",UPPER({TLC})),FIND("${search.toUpperCase()}",UPPER({Batch})),FIND("${search.toUpperCase()}",UPPER({GTIN})))` : undefined,
      sort: [{ field: 'Date', direction: 'desc' }],
    });
  } catch (e) { error = (e as Error).message; }

  return (
    <div className="p-6 space-y-4">
      <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2"><Package size={24}/> Batches</h1>
      <p className="text-brand-sage/60 text-sm">Product batches / TLC inventory · Live from Airtable</p>
      {error && <div className="card p-3 text-brand-brightred text-sm">{error}</div>}
      <form className="card p-3 flex gap-3">
        <input name="q" defaultValue={search} placeholder="Search TLC, Batch, GTIN..." className="input text-sm py-1.5 flex-1" />
        <button type="submit" className="btn-secondary text-sm py-1.5">Search</button>
      </form>
      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-brand-dark/40 border-b border-brand-green/20">
            {['TLC','Date','Batch','PLU','GTIN','Desc Lg','UPC','Origin'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-brand-sage/60 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.records.map((rec, i) => {
              const f = rec.fields;
              return (
                <tr key={rec.id} className={`table-row-hover border-b border-brand-green/10 ${i%2===1?'bg-brand-dark/10':''}`}>
                  <td className="px-3 py-2 font-mono text-brand-gold font-medium">{fieldValue(f['TLC'])}</td>
                  <td className="px-3 py-2 text-brand-sage/70">{String(f['Date']||'')}</td>
                  <td className="px-3 py-2 text-brand-cream/80">{String(f['Batch']||'')}</td>
                  <td className="px-3 py-2 font-mono text-brand-cream/60">{String(f['PLU']||'')}</td>
                  <td className="px-3 py-2 font-mono text-brand-cream/60">{String(f['GTIN']||'')}</td>
                  <td className="px-3 py-2 text-brand-cream/70 max-w-[180px] truncate">{String(f['Desc Lg']||'')}</td>
                  <td className="px-3 py-2 font-mono text-brand-cream/60">{String(f['UPC']||'')}</td>
                  <td className="px-3 py-2 text-brand-sage/60">{String(f['Origin']||'')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-brand-green/20 flex justify-between">
          <span className="text-xs text-brand-sage/60">{data.records.length} batches shown</span>
          {data.offset && <a href={`/batches?offset=${data.offset}${search?`&q=${search}`:''}`} className="btn-secondary text-xs py-1.5">Next →</a>}
        </div>
      </div>
    </div>
  );
}
