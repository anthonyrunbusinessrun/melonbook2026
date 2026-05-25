/**
 * Direct Airtable API client — server-side only
 * Bypasses Postgres sync entirely, fetches live from Airtable
 * Use this for page-level data fetching when sync hasn't run
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appmnU55C5f7A50U4';
const API_KEY = process.env.AIRTABLE_API_KEY || '';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

export type AirtableRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
};

export type PageResult = {
  records: AirtableRecord[];
  offset?: string;
  total?: number;
};

async function atFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string,string> || {}),
    },
    next: { revalidate: 60 }, // cache for 60 seconds
  });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    return atFetch(path, init);
  }
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getTablePage(
  tableId: string,
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    fields?: string[];
    sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
    filterFormula?: string;
    offset?: string;
    view?: string;
  } = {}
): Promise<PageResult> {
  const params = new URLSearchParams();
  params.set('pageSize', String(Math.min(opts.pageSize || 100, 100)));
  if (opts.fields?.length) opts.fields.forEach(f => params.append('fields[]', f));
  if (opts.sort?.length) {
    opts.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction || 'asc');
    });
  }
  if (opts.filterFormula) params.set('filterByFormula', opts.filterFormula);
  if (opts.view) params.set('view', opts.view);
  if (opts.offset) params.set('offset', opts.offset);

  const data = await atFetch(`/${tableId}?${params}`) as PageResult;
  return data;
}

export async function getMetaTables() {
  const data = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    next: { revalidate: 300 },
  });
  return data.json();
}

// Helper: extract clean display value from Airtable field
export function fieldValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString('en-US');
  if (Array.isArray(val)) {
    return val.map(v => {
      if (typeof v === 'object' && v !== null) {
        const o = v as Record<string,unknown>;
        return String(o.name || o.code || o.id || '');
      }
      return String(v);
    }).filter(Boolean).join(', ');
  }
  if (typeof val === 'object') {
    const o = val as Record<string,unknown>;
    if ('linkedRecordIds' in o && 'valuesByLinkedRecordId' in o) {
      // Lookup field
      const ids = o.linkedRecordIds as string[];
      const vals = o.valuesByLinkedRecordId as Record<string, unknown[]>;
      return ids.flatMap(id => (vals[id] || []).map(v => fieldValue(v))).join(', ');
    }
    return String(o.name || o.code || o.url || '');
  }
  return String(val);
}

export function fmtCurrency(val: unknown): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function fmtDate(val: unknown): string {
  if (!val) return '—';
  try { return new Date(String(val)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(val); }
}

// Table IDs
export const TABLES = {
  melonbook:    'tblNkQJv8TnqcFV3P',
  contacts:     'tblqy4XXa2ap3g66T',
  folios:       'tblxvWCSHdMKiOa56',
  vouchers:     'tblUYAd8KBsZi97Pu',
  transactions: 'tblfNYrQKvtOwslbr',
  batches:      'tblIdxdCej9QvdirO',
  items:        'tblOarNFTnDsSaO75',
  attachments:  'tbllwqsWIRSTKIVFf',
  accounts:     'tblmt7JoM80l0vO5I',
  forms:        'tbl4vy605bt4KPDgA',
} as const;
