import { NextResponse } from 'next/server';
import { ALL_TABLES } from '@/lib/airtable-mirror';
import { query } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [counts, status] = await Promise.all([
      query<{ table_id: string; count: string }>(
        `SELECT table_id, COUNT(*) as count FROM airtable_records GROUP BY table_id`
      ),
      query<{ table_id: string; status: string; last_synced_at: string | null; error_message: string | null }>(
        `SELECT table_id, status, last_synced_at, error_message FROM airtable_sync_status`
      ),
    ]);

    const countMap: Record<string, number> = {};
    counts.forEach(r => { countMap[r.table_id] = parseInt(r.count); });

    const statusMap: Record<string, typeof status[0]> = {};
    status.forEach(s => { statusMap[s.table_id] = s; });

    const tables = ALL_TABLES.map(t => ({
      ...t,
      mirrored_count: countMap[t.id] || 0,
      sync_status: statusMap[t.id]?.status || 'idle',
      last_synced_at: statusMap[t.id]?.last_synced_at || null,
      error: statusMap[t.id]?.error_message || null,
    }));

    return NextResponse.json({ tables });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
