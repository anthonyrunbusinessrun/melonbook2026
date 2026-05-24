export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Boxes, PackageCheck, Search, Settings2, Tag, Truck } from 'lucide-react';
import { query } from '@/db';

const ITEMS_TABLE_ID = 'tblOarNFTnDsSaO75';
const BATCHES_TABLE_ID = 'tblIdxdCej9QvdirO';

type MirrorRecord = {
  record_id: string;
  raw_fields: Record<string, unknown>;
  last_synced_at: string;
};

function text(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.name || object.id || JSON.stringify(object));
  }
  return String(value);
}

function number(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return `/inventory?${search.toString()}`;
}

async function getItemRecords(section: string, q: string) {
  const params: unknown[] = [ITEMS_TABLE_ID];
  const where = ['table_id = $1'];

  if (q) {
    params.push(`%${q}%`);
    where.push(`searchable_text ILIKE $${params.length}`);
  }

  if (section === 'system') {
    where.push(`COALESCE(raw_fields->>'Type', '') ILIKE '%system%'`);
  } else {
    where.push(`COALESCE(raw_fields->>'Type', '') NOT ILIKE '%system%'`);
  }

  return query<MirrorRecord>(`
    SELECT record_id, raw_fields, last_synced_at
    FROM airtable_records
    WHERE ${where.join(' AND ')}
    ORDER BY
      COALESCE(raw_fields->>'SKU', raw_fields->>'Title', raw_fields->>'Name', record_id)
    LIMIT 250
  `, params);
}

async function getBatchRecords(q: string) {
  const params: unknown[] = [BATCHES_TABLE_ID];
  const where = ['table_id = $1'];

  if (q) {
    params.push(`%${q}%`);
    where.push(`searchable_text ILIKE $${params.length}`);
  }

  return query<MirrorRecord>(`
    SELECT record_id, raw_fields, last_synced_at
    FROM airtable_records
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(raw_fields->>'Date', '') DESC, COALESCE(raw_fields->>'TLC', raw_fields->>'Batch', record_id)
    LIMIT 150
  `, params);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; q?: string }>
}) {
  const sp = await searchParams;
  const section = sp.section === 'system' || sp.section === 'batches' ? sp.section : 'inventory';
  const q = sp.q || '';

  const [inventoryItems, systemItems, batches, itemStats, batchStats] = await Promise.all([
    getItemRecords('inventory', q),
    getItemRecords('system', q),
    getBatchRecords(q),
    query<{
      type: string;
      count: string;
      total_lbs: string;
    }>(`
      SELECT
        COALESCE(NULLIF(raw_fields->>'Type', ''), 'Unclassified') as type,
        COUNT(*)::text as count,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(raw_fields->>'Lbs', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$'
              THEN REPLACE(raw_fields->>'Lbs', ',', '')::numeric
            ELSE 0
          END
        ), 0)::text as total_lbs
      FROM airtable_records
      WHERE table_id = $1
      GROUP BY 1
      ORDER BY count DESC
    `, [ITEMS_TABLE_ID]),
    query<{
      count: string;
      last_synced_at: string | null;
    }>(`
      SELECT COUNT(*)::text as count, MAX(last_synced_at)::text as last_synced_at
      FROM airtable_records
      WHERE table_id = $1
    `, [BATCHES_TABLE_ID]),
  ]);

  const visibleItems = section === 'system' ? systemItems : inventoryItems;
  const activeRows = section === 'batches' ? batches : visibleItems;
  const batchSummary = batchStats[0];
  const itemCount = itemStats.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const inventoryCount = itemStats
    .filter(row => !row.type.toLowerCase().includes('system'))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const systemCount = itemStats
    .filter(row => row.type.toLowerCase().includes('system'))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Inventory</h1>
          <p className="text-brand-sage/60 text-sm">
            Item catalog, inventory SKUs, system items, and TLC batch tracking from Airtable.
          </p>
        </div>
        <Link href="/data-explorer?table=tblOarNFTnDsSaO75" className="btn-secondary text-sm">
          Open Items in Data Explorer
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Items', value: itemCount.toLocaleString(), icon: Boxes },
          { label: 'Inventory Items', value: inventoryCount.toLocaleString(), icon: PackageCheck },
          { label: 'System Items', value: systemCount.toLocaleString(), icon: Settings2 },
          { label: 'TLC / Batches', value: Number(batchSummary?.count || 0).toLocaleString(), icon: Tag },
        ].map(item => (
          <div key={item.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="label">{item.label}</span>
              <item.icon size={14} className="text-brand-sage" />
            </div>
            <span className="text-lg font-semibold text-brand-cream font-mono">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-brand-dark rounded border border-brand-green/20">
          {[
            { key: 'inventory', label: `Inventory (${inventoryItems.length})` },
            { key: 'system', label: `System (${systemItems.length})` },
            { key: 'batches', label: `Batches (${batches.length})` },
          ].map(tab => (
            <Link
              key={tab.key}
              href={buildHref({ section: tab.key, q })}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                section === tab.key ? 'bg-brand-midgreen text-white' : 'text-brand-warm/65 hover:text-brand-cream'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-2 flex-1 min-w-64">
          <input type="hidden" name="section" value={section} />
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/45" />
            <input name="q" defaultValue={q} placeholder="Search SKU, title, PLU, GTIN, packer..." className="input h-8 pl-8 text-xs" />
          </div>
          <button type="submit" className="btn-primary h-8 px-3 text-xs">Search</button>
          {q && <Link href={buildHref({ section })} className="text-xs text-brand-sage/60 hover:text-brand-sage">Clear</Link>}
        </form>
      </div>

      {section !== 'batches' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>UoM</th>
                    <th className="text-right">Lbs</th>
                    <th>Dims</th>
                    <th>Synced</th>
                    <th>Raw</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-brand-sage/40">No item records found for this filter.</td></tr>
                  ) : visibleItems.map(record => {
                    const f = record.raw_fields;
                    return (
                      <tr key={record.record_id}>
                        <td className="font-mono font-semibold text-brand-sage">{text(f.SKU) || record.record_id}</td>
                        <td><span className={text(f.Type).toLowerCase().includes('system') ? 'badge-gray' : 'badge-green'}>{text(f.Type) || 'Inventory'}</span></td>
                        <td>
                          <div className="text-brand-cream">{text(f.Title || f['Short Title'] || f['Long Title'])}</div>
                          {text(f['Long Title']) && <div className="text-[10px] text-brand-warm/45 truncate max-w-md">{text(f['Long Title'])}</div>}
                        </td>
                        <td className="text-brand-warm/60">{text(f.UoM)}</td>
                        <td className="text-right font-mono">{number(f.Lbs) ? number(f.Lbs).toLocaleString() : '—'}</td>
                        <td className="text-brand-warm/60">{text(f.Dims)}</td>
                        <td className="text-brand-warm/45">{fmtDate(record.last_synced_at)}</td>
                        <td>
                          <details>
                            <summary className="cursor-pointer text-brand-sage/70 text-xs">Fields</summary>
                            <pre className="mt-2 max-w-xl overflow-auto rounded bg-brand-dark p-3 text-[10px] text-brand-warm/70">{JSON.stringify(f, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-brand-cream mb-3">Item Types</h2>
              <div className="space-y-2">
                {itemStats.map(row => (
                  <Link
                    key={row.type}
                    href={buildHref({ section: row.type.toLowerCase().includes('system') ? 'system' : 'inventory', q: row.type })}
                    className="flex items-center justify-between border-b border-brand-green/10 pb-2 text-xs hover:text-brand-sage"
                  >
                    <span className="text-brand-warm/70">{row.type}</span>
                    <span className="font-mono text-brand-cream">{Number(row.count).toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-cream">
                <Truck size={14} className="text-brand-sage" />
                TLC Batch Sync
              </div>
              <p className="text-xs text-brand-sage/55 mt-2">
                {Number(batchSummary?.count || 0).toLocaleString()} batch records mirrored. Last sync {fmtDate(batchSummary?.last_synced_at || null)}.
              </p>
              <Link href={buildHref({ section: 'batches' })} className="btn-secondary text-xs py-1.5 inline-flex mt-3">View Batches</Link>
            </div>
          </aside>
        </div>
      )}

      {section === 'batches' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>TLC</th>
                  <th>Date</th>
                  <th>Batch</th>
                  <th>PLU</th>
                  <th>GTIN</th>
                  <th>UPC</th>
                  <th>Description</th>
                  <th>Origin</th>
                  <th>Packer</th>
                  <th>Raw</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-brand-sage/40">No batch records found.</td></tr>
                ) : batches.map(record => {
                  const f = record.raw_fields;
                  return (
                    <tr key={record.record_id}>
                      <td className="font-mono font-semibold text-brand-sage">{text(f.TLC) || record.record_id}</td>
                      <td>{text(f.Date) ? fmtDate(text(f.Date)) : '—'}</td>
                      <td className="font-mono">{text(f.Batch)}</td>
                      <td>{text(f.PLU)}</td>
                      <td className="font-mono text-brand-warm/60">{text(f.GTIN)}</td>
                      <td className="font-mono text-brand-warm/60">{text(f.UPC)}</td>
                      <td>
                        <div className="text-brand-cream">{text(f['Desc Lg'] || f['Desc Sm'])}</div>
                        {text(f['Desc Sm']) && <div className="text-[10px] text-brand-warm/45">{text(f['Desc Sm'])}</div>}
                      </td>
                      <td>{text(f.Origin)}</td>
                      <td className="max-w-xs truncate">{text(f.Packer)}</td>
                      <td>
                        <details>
                          <summary className="cursor-pointer text-brand-sage/70 text-xs">Fields</summary>
                          <pre className="mt-2 max-w-xl overflow-auto rounded bg-brand-dark p-3 text-[10px] text-brand-warm/70">{JSON.stringify(f, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
