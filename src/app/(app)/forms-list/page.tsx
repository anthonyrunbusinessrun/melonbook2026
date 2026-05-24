export const dynamic = 'force-dynamic';
import { getTablePage, fieldValue, TABLES } from '@/lib/airtable-direct';
import { Layout } from 'lucide-react';

export default async function FormsListPage() {
  let records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}> = [];
  let error = '';
  try {
    const data = await getTablePage(TABLES.forms, { pageSize: 100, sort: [{ field: 'Code', direction: 'asc' }] });
    records = data.records;
  } catch (e) { error = (e as Error).message; }

  return (
    <div className="p-6 space-y-4">
      <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2"><Layout size={24}/> Forms</h1>
      <p className="text-brand-sage/60 text-sm">Form templates used across vouchers · Live from Airtable</p>
      {error && <div className="card p-3 text-brand-brightred text-sm">{error}</div>}
      <div className="grid gap-3">
        {records.map(rec => {
          const f = rec.fields;
          return (
            <div key={rec.id} className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-brand-gold font-bold">{String(f['Code']||'')}</span>
                <span className="badge badge-gray text-xs">{String(f['Type']||'')}</span>
                <span className="badge badge-gray text-xs">{fieldValue(f['Style'])}</span>
              </div>
              <p className="font-semibold text-brand-cream">{String(f['Form Title']||'')}</p>
              {!!f['Long Title'] && <p className="text-brand-cream/60 text-sm">{String(f['Long Title'])}</p>}
              {!!f['Description'] && <p className="text-brand-sage/60 text-xs mt-1">{String(f['Description']).slice(0,200)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
