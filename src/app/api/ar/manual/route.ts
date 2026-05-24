import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { query, queryOne } from '@/db';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const money = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(value => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
});

const optionalString = z.union([z.string(), z.null(), z.undefined()]).transform(value => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
});

const optionalDate = z.union([z.string(), z.null(), z.undefined()]).transform(value => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
});

const arEntrySchema = z.object({
  arYear: z.union([z.string(), z.number()]).optional().transform(value => Number(value || 2026)),
  entryStatus: z.enum(['draft', 'posted', 'void']).optional().default('draft'),
  customerCode: z.string().trim().min(1, 'Customer code is required').max(40),
  customerName: optionalString,
  division: optionalString,
  lotNo: optionalString,
  rNo: optionalString,
  miscPas: optionalString,
  poNo: optionalString,
  invDate: optionalDate,
  depNo: optionalString,
  depDate: optionalDate,
  check1: optionalString,
  check2: optionalString,
  invoiced: money,
  invoiceCredits: money,
  unloadingFee: money,
  adjustments: money,
  amountPaid: money,
  memo: optionalString,
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [entries, customers, summary] = await Promise.all([
    query(`
      SELECT
        id, ar_year, entry_status, customer_code, customer_name, division,
        lot_no, r_no, misc_pas, po_no, inv_date, dep_no, dep_date,
        check1, check2, invoiced, invoice_credits, total_invoiced,
        unloading_fee, adjustments, amount_paid, balance_due, memo,
        created_at, updated_at
      FROM ar_manual_entries
      ORDER BY created_at DESC
      LIMIT 75
    `),
    query(`
      SELECT DISTINCT code, COALESCE(entity_company_name, name) as name
      FROM contacts
      WHERE deleted_at IS NULL AND code IS NOT NULL AND code <> ''
      ORDER BY code
      LIMIT 500
    `),
    queryOne<{
      count: string;
      total_invoiced: string;
      total_paid: string;
      balance_due: string;
    }>(`
      SELECT
        COUNT(*)::text as count,
        COALESCE(SUM(total_invoiced), 0)::text as total_invoiced,
        COALESCE(SUM(amount_paid), 0)::text as total_paid,
        COALESCE(SUM(balance_due), 0)::text as balance_due
      FROM ar_manual_entries
      WHERE entry_status <> 'void'
    `),
  ]);

  return NextResponse.json({ entries, customers, summary });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = arEntrySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid AR entry' }, { status: 400 });
  }

  const input = parsed.data;
  const customer = await queryOne<{ name: string }>(`
    SELECT COALESCE(entity_company_name, name) as name
    FROM contacts
    WHERE code = $1
    LIMIT 1
  `, [input.customerCode.toUpperCase()]);

  const [entry] = await query<{ id: string }>(`
    INSERT INTO ar_manual_entries (
      ar_year, entry_status, customer_code, customer_name, division,
      lot_no, r_no, misc_pas, po_no, inv_date, dep_no, dep_date,
      check1, check2, invoiced, invoice_credits, unloading_fee,
      adjustments, amount_paid, memo, created_by, updated_by, raw_fields
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,$21,$22
    )
    RETURNING id
  `, [
    input.arYear,
    input.entryStatus,
    input.customerCode.toUpperCase(),
    input.customerName || customer?.name || null,
    input.division,
    input.lotNo,
    input.rNo,
    input.miscPas,
    input.poNo,
    input.invDate,
    input.depNo,
    input.depDate,
    input.check1,
    input.check2,
    input.invoiced,
    input.invoiceCredits,
    input.unloadingFee,
    input.adjustments,
    input.amountPaid,
    input.memo,
    sessionUser.id,
    JSON.stringify({
      'Cust ID': input.customerCode.toUpperCase(),
      'Div.': input.division,
      'Lot #': input.lotNo,
      'R #': input.rNo,
      'Misc/PAS': input.miscPas,
      'PO #': input.poNo,
      'Inv Date': input.invDate,
      'Dep #': input.depNo,
      'Dep Date': input.depDate,
      '1st Check #': input.check1,
      '2nd Check #': input.check2,
      'Invoiced': input.invoiced,
      'Invoice Credits': input.invoiceCredits,
      'Unloading Fee': input.unloadingFee,
      'Adjustments': input.adjustments,
      'Amount Paid': input.amountPaid,
      'Memo': input.memo,
    }),
  ]);

  await query(`
    INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values)
    VALUES ($1, $2, 'create_ar_manual_entry', 'ar_manual_entries', $3, $4)
  `, [
    sessionUser.id,
    sessionUser.email || null,
    entry.id,
    JSON.stringify(input),
  ]);

  return NextResponse.json({ success: true, id: entry.id });
}
