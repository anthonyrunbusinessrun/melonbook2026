import { NextResponse } from 'next/server';
import { query } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tables = await query<{
      table_id: string; table_name: string;
      fields: unknown; views: unknown; cached_at: string;
    }>(`SELECT table_id, table_name, fields, views, cached_at
        FROM airtable_schema_cache ORDER BY table_name`);
    return NextResponse.json({ tables });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
