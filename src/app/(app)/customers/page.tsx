import { query } from '@/db';
import { Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; type?: string }>
}) {
  const sp = await searchParams;
  const search = sp.q || '';
  const type = sp.type || 'customers';

  const whereConditions = ['c.deleted_at IS NULL'];
  const params: unknown[] = [];
  let pi = 1;

  if (type === 'customers') { whereConditions.push('c.is_customer = true'); }
  else if (type === 'vendors') { whereConditions.push('c.is_vendor = true'); }
  else if (type === 'freight') { whereConditions.push('c.is_freight = true'); }

  if (search) {
    whereConditions.push(`(c.code ILIKE $${pi} OR c.name ILIKE $${pi} OR c.entity_company_name ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const whereStr = `WHERE ${whereConditions.join(' AND ')}`;

  const contacts = await query<{
    id: string; code: string; name: string; entity_company_name: string;
    city: string; state: string; phone1: string; email: string;
    ar_limit: number; ar_terms: number; last_synced_at: string;
    airtable_record_id: string; is_customer: boolean; is_vendor: boolean; is_freight: boolean;
    invoice_count: number; total_invoiced: number; balance_due: number;
  }>(
    `SELECT c.*,
       COUNT(DISTINCT v.id) FILTER (WHERE v.invoiced_amount > 0) as invoice_count,
       COALESCE(SUM(v.invoiced_amount), 0) as total_invoiced,
       COALESCE(SUM(v.balance_due), 0) as balance_due
     FROM contacts c
     LEFT JOIN vouchers v ON v.issued_contact_id = c.id AND v.deleted_at IS NULL
     ${whereStr}
     GROUP BY c.id
     ORDER BY c.code`,
    params
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Contacts</h1>
          <p className="text-brand-sage/60 text-sm">{contacts.length} records</p>
        </div>
      </div>

      {/* Type tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-brand-forest rounded border border-brand-green/20">
          {[
            { key: 'customers', label: 'Customers' },
            { key: 'vendors',   label: 'Vendors'   },
            { key: 'freight',   label: 'Freight'   },
            { key: 'all',       label: 'All'       },
          ].map(t => (
            <a
              key={t.key}
              href={`/customers?type=${t.key}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className={`px-3 py-1 rounded text-xs transition-colors ${type === t.key ? 'bg-brand-midgreen text-white' : 'text-brand-warm/60 hover:text-brand-cream'}`}
            >
              {t.label}
            </a>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-2 flex-1">
          <input type="hidden" name="type" value={type} />
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
            <input name="q" defaultValue={search} placeholder="Search code, name..." className="input pl-8 h-8 text-xs" />
          </div>
          <button type="submit" className="btn-primary h-8 px-3 text-xs">Search</button>
        </form>
      </div>

      {/* Contacts grid */}
      <div className="card overflow-hidden">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Location</th>
              <th>Phone</th>
              <th>AR Terms</th>
              <th className="text-right">Total Invoiced</th>
              <th className="text-right">Balance Due</th>
              <th>Sync</th>
              <th>AT Link</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-brand-sage/40">No contacts found</td></tr>
            ) : (
              contacts.map(c => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`} className="font-mono font-bold text-brand-sage hover:text-brand-cream transition-colors">
                      {c.code}
                    </Link>
                  </td>
                  <td className="text-brand-cream">{c.entity_company_name || c.name}</td>
                  <td className="text-brand-warm/60">{[c.city, c.state].filter(Boolean).join(', ')}</td>
                  <td className="text-brand-warm/60 font-mono">{c.phone1}</td>
                  <td className="text-brand-warm/60">{c.ar_terms ? `Net ${c.ar_terms}` : '—'}</td>
                  <td className="text-right font-mono">{Number(c.total_invoiced) > 0 ? fmt(Number(c.total_invoiced)) : <span className="text-brand-warm/20">—</span>}</td>
                  <td className={`text-right font-mono font-semibold ${Number(c.balance_due) > 0 ? 'text-brand-gold' : Number(c.balance_due) < 0 ? 'text-brand-brightred' : 'text-brand-warm/20'}`}>
                    {Number(c.balance_due) !== 0 ? fmt(Number(c.balance_due)) : '—'}
                  </td>
                  <td>
                    {c.last_synced_at ? (
                      <span className="badge-green">Synced</span>
                    ) : (
                      <span className="badge-gray">Local</span>
                    )}
                  </td>
                  <td>
                    {c.airtable_record_id && (
                      <a
                        href={`https://airtable.com/appmnU55C5f7A50U4/tblqy4XXa2ap3g66T/${c.airtable_record_id}`}
                        target="_blank"
                        className="text-brand-sage/40 hover:text-brand-sage transition-colors"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
