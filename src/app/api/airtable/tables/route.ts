import { NextResponse } from 'next/server';
import { getAirtableTables, syncAirtableSchema } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let tables = await getAirtableTables();
    if (tables.length === 0) {
      await syncAirtableSchema();
      tables = await getAirtableTables();
    }
    return NextResponse.json({ success: true, tables });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
