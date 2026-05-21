import { NextRequest, NextResponse } from 'next/server';
import { getAirtableRecords } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

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
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 50),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
