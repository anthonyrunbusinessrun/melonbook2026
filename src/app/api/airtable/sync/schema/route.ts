import { NextResponse } from 'next/server';
import { syncSchema } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const count = await syncSchema();
    return NextResponse.json({ success: true, tables: count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
