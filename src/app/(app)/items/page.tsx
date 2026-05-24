export const dynamic = 'force-dynamic';
import { getTablePage, TABLES } from '@/lib/airtable-direct';
import { ShoppingCart } from 'lucide-react';

export default async function ItemsPage() {
  let records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}> = [];
  let error = '';
  try {
    const data = await getTablePage(TABLES.items, { pageSize: 100, sort: [{ field: 'SKU', direction: 'asc' }] });
    records = data.records;
  } catch (e) { error = (e as Error).message; }

  return (
    <div className="p-6 space-y-4">
      <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2"><ShoppingCart size={24}/> Items</h1>
      <p className="text-brand-sage/60 text-sm">Product inventory items · Live from Airtable</p>
      {error && <div className="card p-3 text-brand-brightred text-sm">{error}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-brand-dark/40 border-b border-brand-green/20">
            {['SKU','Type','Short Title','Long Title','UoM','Lbs','Dims','Dr Qty','Cr Qty'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-brand-sage/60 font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {records.map((rec, i) => {
              const f = rec.fields;
              return (
                <tr key={rec.id} className={`table-row-hover border-b border-brand-green/10 ${i%2===1?'bg-brand-dark/10':''}`}>
                  <td className="px-4 py-3 font-mono text-brand-gold font-semibold">{String(f['SKU']||'')}</td>
                  <td className="px-4 py-3 text-brand-sage/60">{String(f['Type']||'')}</td>
                  <td className="px-4 py-3 text-brand-cream font-medium">{String(f['Short Title']||'')}</td>
                  <td className="px-4 py-3 text-brand-cream/70 max-w-[200px] truncate">{String(f['Long Title']||'')}</td>
                  <td className="px-4 py-3 text-brand-cream/60">{String(f['UoM']||'')}</td>
                  <td className="px-4 py-3 text-brand-cream/60">{typeof f['Lbs']==='number'?f['Lbs']+'lb':''}</td>
                  <td className="px-4 py-3 text-brand-cream/60">{String(f['Dims']||'')}</td>
                  <td className="px-4 py-3 font-mono text-brand-gold">{typeof f['Dr Qty']==='number'?f['Dr Qty']:''}</td>
                  <td className="px-4 py-3 font-mono text-brand-sage">{typeof f['Cr Qty']==='number'?f['Cr Qty']:''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
