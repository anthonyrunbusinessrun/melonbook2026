import { query } from '@/db';
import { Truck, Search, ExternalLink } from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  Active: 'badge-green',
  Complete: 'badge-gray',
  Pending: 'badge-gold',
  Cancelled: 'badge-red',
};

export default async function LoadsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; stage?: string }>
}) {
  const sp = await searchParams;
  const search = sp.q || '';
  const stageFilter = sp.stage || '';

  const whereParts = ['f.deleted_at IS NULL'];
  const params: unknown[] = [];
  let pi = 1;

  if (search) {
    whereParts.push(`(f.folio_no ILIKE $${pi} OR f.folio_code ILIKE $${pi} OR f.quick_look ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }
  if (stageFilter) {
    whereParts.push(`f.stage = $${pi}`);
    params.push(stageFilter);
    pi++;
  }

  const where = `WHERE ${whereParts.join(' AND ')}`;

  const [folios, stages] = await Promise.all([
    query<{
      id: string; folio_code: string; folio_no: string; folio_type: string;
      stage: string; load_date: string; quick_look: string; rating: number;
      airtable_record_id: string; last_synced_at: string;
    }>(
      `SELECT f.id, f.folio_code, f.folio_no, f.folio_type, f.stage,
         f.load_date, f.quick_look, f.rating,
         f.airtable_record_id, f.last_synced_at
       FROM folios f
       ${where}
       ORDER BY f.load_date DESC NULLS LAST, f.sort_order ASC
       LIMIT 200`,
      params
    ),
    query<{ stage: string; count: number }>(
      `SELECT stage, COUNT(*) as count FROM folios WHERE deleted_at IS NULL AND stage IS NOT NULL GROUP BY stage ORDER BY count DESC`
    ),
  ]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">Loads / Folios</h1>
          <p className="text-brand-sage/60 text-sm">{folios.length} loads from Melonbook™</p>
        </div>
      </div>

      {/* Stage filter tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-brand-forest rounded border border-brand-green/20">
          {[{ key: '', label: 'All' }, ...stages.map(s => ({ key: s.stage, label: `${s.stage} (${s.count})` }))].map(t => (
            <a
              key={t.key}
              href={`/loads?stage=${t.key}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className={`px-3 py-1 rounded text-xs transition-colors ${stageFilter === t.key ? 'bg-brand-midgreen text-white' : 'text-brand-warm/60 hover:text-brand-cream'}`}
            >
              {t.label}
            </a>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-2">
          {stageFilter && <input type="hidden" name="stage" value={stageFilter} />}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
            <input name="q" defaultValue={search} placeholder="Search lot, folio..." className="input pl-8 h-8 text-xs w-44" />
          </div>
          <button type="submit" className="btn-primary h-8 px-3 text-xs">Search</button>
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Folio / Lot</th>
              <th>Type</th>
              <th>Stage</th>
              <th>Load Date</th>
              <th>Quick Look</th>
              <th>Rating</th>
              <th>Sync</th>
              <th>AT Link</th>
            </tr>
          </thead>
          <tbody>
            {folios.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-brand-sage/40">No loads found — run Airtable sync</td></tr>
            ) : (
              folios.map(f => (
                <tr key={f.id}>
                  <td className="font-mono font-bold text-brand-sage">{f.folio_code || f.folio_no}</td>
                  <td className="text-brand-warm/60">{f.folio_type}</td>
                  <td>
                    <span className={STAGE_COLORS[f.stage] || 'badge-gray'}>{f.stage || '—'}</span>
                  </td>
                  <td>{f.load_date ? new Date(f.load_date).toLocaleDateString() : '—'}</td>
                  <td className="text-brand-warm/60 text-xs max-w-xs truncate">{f.quick_look}</td>
                  <td>{f.rating ? '★'.repeat(f.rating) : '—'}</td>
                  <td>
                    {f.last_synced_at ? <span className="badge-green">Synced</span> : <span className="badge-gray">Local</span>}
                  </td>
                  <td>
                    {f.airtable_record_id && (
                      <a
                        href={`https://airtable.com/appmnU55C5f7A50U4/tblxvWCSHdMKiOa56/${f.airtable_record_id}`}
                        target="_blank"
                        className="text-brand-sage/40 hover:text-brand-sage"
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
