import { NextResponse } from 'next/server';
import { getAirtableSyncStatus } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getAirtableSyncStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
