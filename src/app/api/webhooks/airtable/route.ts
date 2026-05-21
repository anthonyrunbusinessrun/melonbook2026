import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { syncContacts, syncTransactions, syncVouchers } from '@/lib/sync';
import { syncAirtableSchema, syncAirtableTableRecords } from '@/lib/airtable-mirror';
import crypto from 'crypto';

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

  // Determine which table changed and trigger targeted sync
  const tableId = payload.tableId as string;

  try {
    if (tableId) {
      await syncAirtableSchema();
      await syncAirtableTableRecords(tableId);
    }

    if (tableId === 'tblqy4XXa2ap3g66T') {
      await syncContacts();
    } else if (tableId === 'tblfNYrQKvtOwslbr') {
      await syncTransactions();
    } else if (tableId === 'tblUYAd8KBsZi97Pu') {
      await syncVouchers();
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook processing failed:', e);
    return NextResponse.json({ received: true, error: 'Processing failed, event stored' });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'airtable-webhook' });
}
