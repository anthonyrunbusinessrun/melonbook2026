import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, transaction } from '@/db';
import { parseARSpreadsheet } from '@/lib/ar-spreadsheet-import';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload a spreadsheet file first.' }, { status: 400 });
    }

    const previewOnly = formData.get('previewOnly') === 'true';
    const parsed = parseARSpreadsheet(await file.arrayBuffer(), file.name);
    const entries = parsed.entries.slice(0, 2000);

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        previewOnly: true,
        sheetName: parsed.sheetName,
        entries: entries.slice(0, 25),
        rowCount: parsed.entries.length,
        warnings: parsed.warnings,
      });
    }

    if (entries.length === 0) {
      return NextResponse.json({
        error: 'No AR rows were found to import.',
        sheetName: parsed.sheetName,
        warnings: parsed.warnings,
      }, { status: 400 });
    }

    const customerRows = await query<{ code: string; name: string }>(`
      SELECT DISTINCT code, COALESCE(entity_company_name, name) as name
      FROM contacts
      WHERE deleted_at IS NULL AND code IS NOT NULL AND code <> ''
    `);
    const customerMap = new Map(customerRows.map(row => [row.code.toUpperCase(), row.name]));

    const insertedIds = await transaction(async client => {
      const ids: string[] = [];

      for (const entry of entries) {
        const customerCode = entry.customerCode.toUpperCase();
        const customerName = entry.customerName || customerMap.get(customerCode) || null;
        const result = await client.query<{ id: string }>(`
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
          entry.arYear,
          entry.entryStatus,
          customerCode,
          customerName,
          entry.division,
          entry.lotNo,
          entry.rNo,
          entry.miscPas,
          entry.poNo,
          entry.invDate,
          entry.depNo,
          entry.depDate,
          entry.check1,
          entry.check2,
          entry.invoiced,
          entry.invoiceCredits,
          entry.unloadingFee,
          entry.adjustments,
          entry.amountPaid,
          entry.memo,
          sessionUser.id,
          JSON.stringify({
            source: 'spreadsheet_upload',
            filename: file.name,
            sheetName: parsed.sheetName,
            ...entry,
          }),
        ]);
        ids.push(result.rows[0].id);
      }

      await client.query(`
        INSERT INTO audit_log (user_id, user_email, action, table_name, new_values)
        VALUES ($1, $2, 'import_ar_manual_entries', 'ar_manual_entries', $3)
      `, [
        sessionUser.id,
        sessionUser.email || null,
        JSON.stringify({
          filename: file.name,
          sheetName: parsed.sheetName,
          imported: ids.length,
          warnings: parsed.warnings,
        }),
      ]);

      return ids;
    });

    return NextResponse.json({
      success: true,
      sheetName: parsed.sheetName,
      imported: insertedIds.length,
      skipped: Math.max(parsed.entries.length - insertedIds.length, 0),
      warnings: parsed.warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
