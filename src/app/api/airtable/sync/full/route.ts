import { NextResponse } from 'next/server';
import { syncAllTables, syncSchema } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST() {
  try {
    const schemaCount = await syncSchema().catch(e => { console.error('Schema sync failed:', e); return 0; });
    const results = await syncAllTables();
    return NextResponse.json({ success: true, schemaCount, tables: results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
