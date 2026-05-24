import { NextResponse } from 'next/server';
import { syncAirtableSchema } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await syncAirtableSchema();
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
