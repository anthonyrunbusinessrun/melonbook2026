import { NextResponse } from 'next/server';
import { syncAllAirtableRecords } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

export async function POST() {
  try {
    const result = await syncAllAirtableRecords();
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
