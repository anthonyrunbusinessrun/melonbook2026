import { NextResponse } from 'next/server';
import { syncAirtableSchema, syncAirtableTableRecords } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;

  try {
    await syncAirtableSchema();
    const result = await syncAirtableTableRecords(tableId);
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
