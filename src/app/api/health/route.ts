import { NextResponse } from 'next/server';
import { queryOne } from '@/db';

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
