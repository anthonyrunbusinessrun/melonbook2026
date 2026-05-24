export const dynamic = 'force-dynamic';
import { getTablePage, TABLES } from '@/lib/airtable-direct';
import { BookOpen, Lightbulb, CheckCircle, Clock, XCircle, Link as LinkIcon } from 'lucide-react';

const TYPE_ICON: Record<string, string> = {
  'Training Docs': '📚',
  'Enhancement': '✨',
  'Bug': '🐛',
  'Feature': '🚀',
  'System': '⚙️',
};

const STATUS_COLOR: Record<string, string> = {
  'Open': 'badge-gold',
  'Closed': 'badge-gray',
  'In Progress': 'badge-green',
};

export default async function MelonbookPage() {
  let records: Array<{id: string; createdTime: string; fields: Record<string, unknown>}> = [];
  let error = '';
  try {
    const data = await getTablePage(TABLES.melonbook, {
      pageSize: 100,
      sort: [{ field: 'ID', direction: 'asc' }],
    });
    records = data.records;
  } catch (e) { error = (e as Error).message; }

  const openItems = records.filter(r => !r.fields['Status'] || String((r.fields['Status'] as Record<string,unknown>)?.name || '') !== 'Closed');
  const closedItems = records.filter(r => String((r.fields['Status'] as Record<string,unknown>)?.name || '') === 'Closed');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2">
          <BookOpen size={24} /> Melonbook™
        </h1>
        <p className="text-brand-sage/60 text-sm">
          System roadmaps, training materials & operational notes · Melonbook™ 2026 base
        </p>
      </div>

      {error && <div className="card p-3 text-brand-brightred text-sm">{error}</div>}

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="label flex items-center gap-1"><Lightbulb size={11} /> Total Items</div>
          <div className="text-2xl font-bold text-brand-cream">{records.length}</div>
        </div>
        <div className="stat-card">
          <div className="label flex items-center gap-1"><Clock size={11} /> Open</div>
          <div className="text-2xl font-bold text-brand-gold">{openItems.length}</div>
        </div>
        <div className="stat-card">
          <div className="label flex items-center gap-1"><CheckCircle size={11} /> Closed</div>
          <div className="text-2xl font-bold text-brand-sage">{closedItems.length}</div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="space-y-4">
        {records.map(rec => {
          const f = rec.fields;
          const sys = String(f['SYS'] || '');
          const title = String(f['Title'] || '');
          const desc = String(f['Description'] || '');
          const by = String(f['By'] || '');
          const typeObj = f['Type'] as Record<string,unknown> | null;
          const typeName = typeObj?.name as string || '';
          const statusObj = f['Status'] as Record<string,unknown> | null;
          const statusName = statusObj?.name as string || '';
          const created = f['Created'] ? new Date(String(f['Created'])).toLocaleDateString() : '';

          // Check if description looks like a URL or token
          const isSecret = desc.length > 30 && !desc.includes(' ') && (desc.includes('.') || desc.startsWith('pat'));
          const isSensitive = title.toLowerCase().includes('password') || title.toLowerCase().includes('token') || title.toLowerCase().includes('key');

          return (
            <div key={rec.id} className={`card p-5 ${statusName === 'Closed' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-brand-gold text-sm font-bold">{sys}</span>
                  <span className="text-lg">{TYPE_ICON[typeName] || '📋'}</span>
                  {typeName && <span className={`badge text-[10px] ${STATUS_COLOR[statusName] || 'badge-gray'}`}>{typeName}</span>}
                  {statusName && <span className={`badge text-[10px] ${STATUS_COLOR[statusName] || 'badge-gray'}`}>{statusName}</span>}
                </div>
                {by && <span className="text-xs text-brand-sage/40">{by} · {created}</span>}
              </div>
              <h3 className="font-semibold text-brand-cream mb-2">{title || '(No title)'}</h3>
              {desc && !isSecret && !isSensitive && (
                <p className="text-brand-warm/70 text-sm leading-relaxed">{desc}</p>
              )}
              {(isSecret || isSensitive) && (
                <p className="text-brand-gold/60 text-xs italic">🔒 Sensitive content — view in Airtable</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-4 text-center">
        <a
          href="https://airtable.com/appmnU55C5f7A50U4/tblNkQJv8TnqcFV3P"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <LinkIcon size={13} /> Open in Airtable
        </a>
      </div>
    </div>
  );
}
