import { NextResponse } from 'next/server';
import { queryOne } from '@/db';
import { syncAllAirtableRecords } from '@/lib/airtable-mirror';

declare global {
  // eslint-disable-next-line no-var
  var __melonbookAirtableHealthSync: Promise<unknown> | undefined;
}

function maybeStartAirtableHealthSync(lastSyncedAt: string | null) {
  if (!process.env.AIRTABLE_API_KEY) return 'missing_airtable_key';
  if (globalThis.__melonbookAirtableHealthSync) return 'already_running';

  const lastSync = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const isStale = !lastSync || Number.isNaN(lastSync.getTime()) || Date.now() - lastSync.getTime() > 10 * 60 * 1000;
  if (!isStale) return 'fresh';

  globalThis.__melonbookAirtableHealthSync = syncAllAirtableRecords()
    .catch(error => {
      console.error('[Health Airtable Sync] failed:', error);
      return null;
    })
    .finally(() => {
      globalThis.__melonbookAirtableHealthSync = undefined;
    });

  return 'started';
}

export async function GET() {
  try {
    const [dbRow, mirrorRow] = await Promise.all([
      queryOne<{ now: string }>('SELECT NOW() as now'),
      queryOne<{
        table_count: string;
        record_count: string;
        last_synced_at: string | null;
        error_count: string;
      }>(`
        SELECT
          (SELECT COUNT(*)::text FROM airtable_tables) as table_count,
          (SELECT COUNT(*)::text FROM airtable_records) as record_count,
          (SELECT MAX(last_synced_at)::text FROM airtable_records) as last_synced_at,
          (SELECT COUNT(*)::text FROM airtable_sync_status WHERE sync_error IS NOT NULL) as error_count
      `).catch(() => null),
    ]);
    const airtableAutoSync = mirrorRow ? maybeStartAirtableHealthSync(mirrorRow.last_synced_at) : 'mirror_unavailable';

    return NextResponse.json({
      status: 'ok',
      version: '1.0.0',
      db: dbRow ? 'connected' : 'error',
      airtableMirror: mirrorRow ? {
        tables: Number(mirrorRow.table_count || 0),
        records: Number(mirrorRow.record_count || 0),
        lastSyncedAt: mirrorRow.last_synced_at,
        errors: Number(mirrorRow.error_count || 0),
      } : null,
      airtableAutoSync,
      timestamp: new Date().toISOString(),
      app: 'MelonBook — Raymon J Land',
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    });
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      db: 'disconnected',
      error: (e as Error).message,
    }, { status: 503 });
  }
}
