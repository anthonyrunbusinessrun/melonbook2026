import { NextRequest, NextResponse } from 'next/server';
import { syncTableRecords, ALL_TABLES } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;
  const table = ALL_TABLES.find(t => t.id === tableId);
  if (!table) {
    return NextResponse.json({ error: 'Unknown table' }, { status: 404 });
  }
  try {
    const result = await syncTableRecords(table.id, table.name);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
