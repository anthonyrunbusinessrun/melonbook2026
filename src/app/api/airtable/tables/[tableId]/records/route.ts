import { NextRequest, NextResponse } from 'next/server';
import { getTableRecords, getSchemaForTable } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50'), 200);
  const search = url.searchParams.get('search') || undefined;

  try {
    const [data, schema] = await Promise.all([
      getTableRecords(tableId, page, pageSize, search),
      getSchemaForTable(tableId),
    ]);
    return NextResponse.json({ ...data, schema });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
