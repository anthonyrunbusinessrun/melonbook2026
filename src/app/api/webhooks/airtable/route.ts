import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { syncContacts, syncTransactions, syncVouchers } from '@/lib/sync';
import { syncAirtableSchema, syncAirtableTableRecords } from '@/lib/airtable-mirror';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

// Airtable webhook secret for HMAC verification
const WEBHOOK_SECRET = process.env.AIRTABLE_WEBHOOK_SECRET || '';

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true; // Allow in dev without secret
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function collectTableIds(value: unknown, found = new Set<string>()) {
  if (!value) return found;

  if (typeof value === 'string' && /^tbl[a-zA-Z0-9]+$/.test(value)) {
    found.add(value);
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectTableIds(item, found));
    return found;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      if (/^tbl[a-zA-Z0-9]+$/.test(key)) found.add(key);
      collectTableIds(nested, found);
    });
  }

  return found;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-airtable-content-mac') || '';

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Store webhook event
  await query(`
    INSERT INTO sync_webhook_events (airtable_base_id, event_type, payload)
    VALUES ($1, $2, $3)
  `, ['appmnU55C5f7A50U4', payload.type || 'unknown', JSON.stringify(payload)]);

  // Determine which tables changed and trigger targeted mirror refreshes.
  const tableIds = Array.from(collectTableIds(payload));

  try {
    await syncAirtableSchema();

    for (const tableId of tableIds) {
      await syncAirtableTableRecords(tableId);

      if (tableId === 'tblqy4XXa2ap3g66T') {
        await syncContacts();
      } else if (tableId === 'tblfNYrQKvtOwslbr') {
        await syncTransactions();
      } else if (tableId === 'tblUYAd8KBsZi97Pu') {
        await syncVouchers();
      }
    }

    return NextResponse.json({ received: true, syncedTables: tableIds });
  } catch (e) {
    console.error('Webhook processing failed:', e);
    return NextResponse.json({ received: true, error: 'Processing failed, event stored' });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'airtable-webhook' });
}
