export const dynamic = 'force-dynamic';
import { getTablePage, fieldValue, fmtDate, TABLES } from '@/lib/airtable-direct';
import Link from 'next/link';
import { Search, Users, Building2, Phone, Mail } from 'lucide-react';

export default async function ContactsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; type?: string; offset?: string }> }) {
  const sp = await searchParams;
  const search = sp.q || '';
  const typeFilter = sp.type || '';
  const offset = sp.offset || undefined;

  const filters: string[] = [];
  if (search) filters.push(`OR(FIND("${search.toUpperCase()}",UPPER({Code})),FIND("${search.toUpperCase()}",UPPER({Name})))`);
  if (typeFilter) filters.push(`{Type}="${typeFilter}"`);
  const filterFormula = filters.length > 1 ? `AND(${filters.join(',')})` : filters[0];

  let data: { records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}>; offset?: string } = { records: [] };
  let error = '';
  try {
    data = await getTablePage(TABLES.contacts, {
      pageSize: 100, offset,
      filterFormula: filterFormula || undefined,
      sort: [{ field: 'Code', direction: 'asc' }],
    });
  } catch (e) { error = (e as Error).message; }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2">
            <Users size={24} /> Contacts
          </h1>
          <p className="text-brand-sage/60 text-sm">998 contacts · Customers, Vendors, Freight carriers</p>
        </div>
      </div>

      <form className="card p-3 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
          <input name="q" defaultValue={search} placeholder="Search code or name..." className="input pl-8 text-sm py-1.5 w-full" />
        </div>
        <select name="type" defaultValue={typeFilter} className="select text-sm py-1.5 w-36">
          <option value="">All Types</option>
          <option value="Store">Store</option>
          <option value="Farm">Farm</option>
          <option value="Broker">Broker</option>
          <option value="Vendor">Vendor</option>
        </select>
        <button type="submit" className="btn-secondary text-sm py-1.5">Filter</button>
        {(search || typeFilter) && <Link href="/contacts" className="text-brand-sage/60 text-sm hover:text-brand-cream self-center">Clear</Link>}
      </form>

      {error && <div className="card p-3 border-brand-brightred/30 text-brand-brightred text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-dark/40 border-b border-brand-green/20">
              {['Code','Name','Type','Email','Phone','A/R Limit','Created'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-brand-sage/60 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.records.map((rec, i) => {
              const f = rec.fields;
              return (
                <tr key={rec.id} className={`table-row-hover border-b border-brand-green/10 ${i % 2 === 1 ? 'bg-brand-dark/10' : ''}`}>
                  <td className="px-3 py-2 font-mono text-brand-gold font-medium">{String(f['Code'] || '')}</td>
                  <td className="px-3 py-2 text-brand-cream/80 font-medium max-w-[180px] truncate">{String(f['Name'] || '')}</td>
                  <td className="px-3 py-2">
                    {f['Type'] != null && <span className="badge badge-gray text-[10px]">{fieldValue(f['Type'] as unknown)}</span>}
                  </td>
                  <td className="px-3 py-2 text-brand-sage/60 max-w-[160px] truncate">
                    <span className="flex items-center gap-1">
                      {!!(f['eMail'] || f['Quick Note']) && <Mail size={10} />}
                      {String(f['eMail'] || f['Quick Note'] || '')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-brand-sage/60 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {!!f['Phone 1'] && <Phone size={10} />}
                      {String(f['Phone 1'] || '')}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-brand-cream/70">
                    {typeof f['A/R Limit'] === 'number' ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(f['A/R Limit'] as number) : '—'}
                  </td>
                  <td className="px-3 py-2 text-brand-sage/50">{fmtDate(rec.createdTime)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-brand-green/20 flex items-center justify-between">
          <span className="text-xs text-brand-sage/60">{data.records.length} contacts shown</span>
          {data.offset && (
            <Link href={`/contacts?offset=${data.offset}${search?`&q=${search}`:''}${typeFilter?`&type=${typeFilter}`:''}`}
              className="btn-secondary text-xs py-1.5">Next →</Link>
          )}
        </div>
      </div>
    </div>
  );
}
