import { NextResponse } from 'next/server';
import { getSyncStatus } from '@/lib/airtable-mirror';
import { query } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [status, counts] = await Promise.all([
      getSyncStatus(),
      query<{ table_id: string; count: string }>(
        `SELECT table_id, COUNT(*) as count FROM airtable_records GROUP BY table_id`
      ),
    ]);

    const countMap: Record<string, number> = {};
    counts.forEach(r => { countMap[r.table_id] = parseInt(r.count); });

    const enriched = status.map(s => ({
      ...s,
      mirrored_count: countMap[s.table_id] ?? s.mirrored_count,
    }));

    return NextResponse.json({ tables: enriched, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
