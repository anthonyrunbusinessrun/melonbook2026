import { NextResponse } from 'next/server';
import { query } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tables = await query<{
      table_id: string; table_name: string;
      fields: unknown; views: unknown; cached_at: string | null;
    }>(`
      SELECT
        t.table_id,
        t.table_name,
        COALESCE(
          jsonb_agg(DISTINCT f.raw_schema) FILTER (WHERE f.field_id IS NOT NULL),
          '[]'::jsonb
        ) as fields,
        COALESCE(
          jsonb_agg(DISTINCT v.raw_schema) FILTER (WHERE v.view_id IS NOT NULL),
          '[]'::jsonb
        ) as views,
        t.last_synced_at::text as cached_at
      FROM airtable_tables t
      LEFT JOIN airtable_fields f ON f.table_id = t.table_id
      LEFT JOIN airtable_views v ON v.table_id = t.table_id
      GROUP BY t.table_id, t.table_name, t.last_synced_at
      ORDER BY t.table_name
    `);
    return NextResponse.json({ tables });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
