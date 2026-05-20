import { NextRequest, NextResponse } from 'next/server';
import { runFullSync, syncContacts, syncTransactions, processOutbox } from '@/lib/sync';
import { query } from '@/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  try {
    let result: unknown;

    switch (type) {
      case 'full':
        result = await runFullSync();
        break;

      case 'contacts':
        result = await syncContacts();
        break;

      case 'transactions':
        result = await syncTransactions();
        break;

      case 'outbox':
        result = await processOutbox(50);
        break;

      case 'reconcile': {
        const { reconcileAR } = await import('@/lib/sync');
        result = await reconcileAR();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown sync type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, type, result });

  } catch (e) {
    console.error(`Sync ${type} failed:`, e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  if (type === 'status') {
    const [runs, outbox, conflicts] = await Promise.all([
      query(`SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 10`),
      query(`SELECT status, COUNT(*) as count FROM sync_outbox GROUP BY status`),
      query(`SELECT COUNT(*) as count FROM conflict_audit WHERE resolved_at > NOW() - INTERVAL '24 hours'`),
    ]);
    return NextResponse.json({ runs, outbox, conflicts });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
