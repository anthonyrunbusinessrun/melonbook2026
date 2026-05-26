import { NextRequest, NextResponse } from 'next/server';
import { createAirtableRecord, getAirtableRecords, type AirtableRecordFilter } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

function parseFilters(value: string | null): AirtableRecordFilter[] | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.slice(0, 12).filter(filter =>
    filter &&
    typeof filter.field === 'string' &&
    typeof filter.op === 'string'
  ) as AirtableRecordFilter[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;
  const searchParams = request.nextUrl.searchParams;

  try {
    const result = await getAirtableRecords({
      tableId,
      search: searchParams.get('q') || undefined,
      filters: parseFilters(searchParams.get('filters')),
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 50),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;

  try {
    const body = await request.json();
    const record = await createAirtableRecord(tableId, body.fields || {});
    return NextResponse.json({ success: true, record });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
