import { NextResponse } from 'next/server';
import { queryOne } from '@/db';

export async function GET() {
  try {
    const [dbRow] = await Promise.all([
      queryOne<{ now: string }>('SELECT NOW() as now'),
    ]);
    return NextResponse.json({
      status: 'ok',
      version: '1.0.0',
      db: dbRow ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
      app: 'MelonOps — Raymon J Land',
    });
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      db: 'disconnected',
      error: (e as Error).message,
    }, { status: 503 });
  }
}
