import { NextResponse } from 'next/server';
import { queryOne } from '@/db';
import { syncAllAirtableRecords } from '@/lib/airtable-mirror';

export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var __melonbookAirtableBootstrap: Promise<unknown> | undefined;
}

async function mirrorRecordCount() {
  const row = await queryOne<{ count: string }>(`
    SELECT COUNT(*)::text as count
    FROM airtable_records
  `).catch(() => null);
  return Number(row?.count || 0);
}

function startBootstrap() {
  if (!globalThis.__melonbookAirtableBootstrap) {
    globalThis.__melonbookAirtableBootstrap = syncAllAirtableRecords()
      .catch(error => {
        console.error('[Airtable Bootstrap] failed:', error);
        throw error;
      })
      .finally(() => {
        globalThis.__melonbookAirtableBootstrap = undefined;
      });
  }
  return globalThis.__melonbookAirtableBootstrap;
}

export async function GET() {
  const existingRecords = await mirrorRecordCount();
  if (existingRecords > 0) {
    return NextResponse.json({
      success: true,
      status: 'already_synced',
      records: existingRecords,
    });
  }

  const running = Boolean(globalThis.__melonbookAirtableBootstrap);
  startBootstrap();

  return NextResponse.json({
    success: true,
    status: running ? 'already_running' : 'started',
    message: 'Initial Airtable mirror sync is running in the background. Watch /api/health for table and record counts.',
  });
}
