import { NextRequest, NextResponse } from 'next/server';
import { deleteAirtableRecord, updateAirtableRecord } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string }> }
) {
  const { tableId, recordId } = await params;

  try {
    const body = await request.json();
    const record = await updateAirtableRecord(tableId, recordId, body.fields || {});
    return NextResponse.json({ success: true, record });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string }> }
) {
  const { tableId, recordId } = await params;

  try {
    const result = await deleteAirtableRecord(tableId, recordId);
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
