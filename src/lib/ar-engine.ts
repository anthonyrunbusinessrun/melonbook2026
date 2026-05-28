/**
 * AR Report Engine
 * Replicates the logic of "2026 AR Spreadsheet.xlsx"
 *
 * Column layout (A-S):
 *   Cust ID | Div. | Lot # | R # | Misc/PAS | PO # | Inv Date |
 *   Dep # | Dep Date | 1st Check # | 2nd Check # |
 *   Invoiced | Invoice Credits | Total Invoiced |
 *   Unloading Fee | Adjustments | Amount Paid | Balance Due | Memo
 *
 * Formulas:
 *   Total Invoiced = Invoiced + Invoice Credits
 *   Balance Due = Total Invoiced + Unloading Fee + Adjustments - Amount Paid
 */

import { query } from '@/db';
import ExcelJS from 'exceljs';
import { TRANSACTIONS_TABLE_ID } from '@/lib/airtable-mirror';

export interface ARRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  division: string | null;
  lotNo: string | null;
  rNo: string | null;
  miscPas: string | null;
  poNo: string | null;
  invDate: Date | null;
  depNo: string | null;
  depDate: Date | null;
  check1: string | null;
  check2: string | null;
  invoiced: number;
  invoiceCredits: number;
  totalInvoiced: number;
  unloadingFee: number;
  adjustments: number;
  amountPaid: number;
  balanceDue: number;
  memo: string | null;
  voucherId: string | null;
  airtableVoucherId: string | null;
}

export interface CustomerARTotal {
  customerCode: string;
  customerName: string;
  invoiced: number;
  invoiceCredits: number;
  totalInvoiced: number;
  unloadingFee: number;
  adjustments: number;
  amountPaid: number;
  balanceDue: number;
  rowCount: number;
  rows: ARRow[];
}

export interface ARReport {
  reportDate: Date;
  customers: CustomerARTotal[];
  grandTotals: {
    invoiced: number;
    invoiceCredits: number;
    totalInvoiced: number;
    unloadingFee: number;
    adjustments: number;
    amountPaid: number;
    balanceDue: number;
  };
}

// ============================================================
// AR FORMULA FUNCTIONS (unit-testable pure functions)
// ============================================================
export function computeTotalInvoiced(invoiced: number, invoiceCredits: number): number {
  return invoiced + invoiceCredits;
}

export function computeBalanceDue(
  totalInvoiced: number,
  unloadingFee: number,
  adjustments: number,
  amountPaid: number
): number {
  return totalInvoiced + unloadingFee + adjustments - amountPaid;
}

// ============================================================
// BUILD AR REPORT FROM POSTGRES
// ============================================================
export async function buildARReport(
  options: {
    asOfDate?: Date;
    customerCodes?: string[];
    includeZeroBalance?: boolean;
  } = {}
): Promise<ARReport> {
  const { asOfDate = new Date(), customerCodes, includeZeroBalance = true } = options;

  // Query: join transactions → vouchers → contacts
  // Account 1152 = Accounts Receivable (invoiced amounts)
  // Account 1122 = Undeposited Funds (payments)
  // We build AR rows at the voucher (invoice) level
  const sql = `
    WITH
    -- Get all invoices (debits on AR account 1152)
    ar_invoiced AS (
      SELECT
        t.voucher_id,
        SUM(CASE WHEN t.debit > 0 THEN t.debit ELSE 0 END) as invoiced,
        SUM(CASE WHEN t.credit > 0 THEN t.credit ELSE 0 END) as invoice_credits
      FROM transactions t
      WHERE t.account_no = 1152
        AND t.deleted_at IS NULL
        AND (t.accrue_date IS NULL OR t.accrue_date <= $1)
      GROUP BY t.voucher_id
    ),
    -- Get all payments (credits on account 1122)
    ar_paid AS (
      SELECT
        t.voucher_id,
        SUM(CASE WHEN t.credit > 0 THEN t.credit ELSE 0 END) as amount_paid
      FROM transactions t
      WHERE t.account_no = 1122
        AND t.deleted_at IS NULL
      GROUP BY t.voucher_id
    ),
    -- Get unloading fees (specific account - to be configured)
    ar_unloading AS (
      SELECT
        t.voucher_id,
        SUM(t.debit - COALESCE(t.credit, 0)) as unloading_fee
      FROM transactions t
      WHERE t.account_no IN (5100, 5101)  -- Unloading fee accounts
        AND t.deleted_at IS NULL
      GROUP BY t.voucher_id
    ),
    -- Get adjustments
    ar_adj AS (
      SELECT
        t.voucher_id,
        SUM(CASE WHEN t.credit > 0 THEN -t.credit ELSE t.debit END) as adjustments
      FROM transactions t
      WHERE t.account_no IN (4900, 4901)  -- Adjustment accounts
        AND t.deleted_at IS NULL
      GROUP BY t.voucher_id
    )
    SELECT
      v.id as voucher_id,
      v.airtable_record_id as at_voucher_id,
      v.voucher_code,
      v.lot_no,
      v.r_no,
      v.reference2 as po_no,
      v.memo,
      v.via_free_entry as misc_pas,
      v.accrue_date as inv_date,
      v.dep_no,
      v.dep_date,
      v.ck_no as check1,
      v.ck_no2 as check2,
      v.division,
      -- Customer info
      issued.id as customer_id,
      issued.code as customer_code,
      COALESCE(issued.entity_company_name, issued.name) as customer_name,
      -- Financial
      COALESCE(ai.invoiced, 0) as invoiced,
      COALESCE(ai.invoice_credits, 0) as invoice_credits,
      COALESCE(ap.amount_paid, 0) as amount_paid,
      COALESCE(au.unloading_fee, 0) as unloading_fee,
      COALESCE(adj.adjustments, 0) as adjustments
    FROM vouchers v
    LEFT JOIN contacts issued ON issued.id = v.issued_contact_id
    LEFT JOIN ar_invoiced ai ON ai.voucher_id = v.id
    LEFT JOIN ar_paid ap ON ap.voucher_id = v.id
    LEFT JOIN ar_unloading au ON au.voucher_id = v.id
    LEFT JOIN ar_adj adj ON adj.voucher_id = v.id
    WHERE v.deleted_at IS NULL
      AND issued.is_customer = true
      AND (
        ai.invoiced > 0
        OR ap.amount_paid > 0
      )
      ${customerCodes?.length ? `AND issued.code = ANY($2)` : ''}
    ORDER BY issued.code, v.accrue_date, v.lot_no::integer NULLS LAST
  `;

  const params: unknown[] = [asOfDate];
  if (customerCodes?.length) params.push(customerCodes);

  const rows = await query<{
    voucher_id: string;
    at_voucher_id: string;
    customer_id: string;
    customer_code: string;
    customer_name: string;
    lot_no: string;
    r_no: string;
    po_no: string;
    misc_pas: string;
    inv_date: Date;
    dep_no: string;
    dep_date: Date;
    check1: string;
    check2: string;
    division: string;
    memo: string;
    invoiced: number;
    invoice_credits: number;
    amount_paid: number;
    unloading_fee: number;
    adjustments: number;
  }>(sql, params);

  // If no transaction-level data, fall back to voucher-level denormalized amounts
  const arRowsFromVouchers = rows.length === 0
    ? await buildARFromVoucherAmounts(options)
    : null;

  const source: any[] = arRowsFromVouchers || rows;

  // Group by customer
  const customerMap = new Map<string, CustomerARTotal>();

  for (const r of source) {
    const invoiced = Number(r.invoiced || 0);
    const invoiceCredits = Number(r.invoice_credits || 0);
    const unloadingFee = Number(r.unloading_fee || 0);
    const adjustments = Number(r.adjustments || 0);
    const amountPaid = Number(r.amount_paid || 0);
    const totalInvoiced = computeTotalInvoiced(invoiced, invoiceCredits);
    const balanceDue = computeBalanceDue(totalInvoiced, unloadingFee, adjustments, amountPaid);

    if (!includeZeroBalance && balanceDue === 0 && invoiced === 0) continue;

    const arRow: ARRow = {
      customerId: r.customer_id,
      customerCode: r.customer_code,
      customerName: r.customer_name,
      division: r.division || null,
      lotNo: r.lot_no || null,
      rNo: r.r_no || null,
      miscPas: r.misc_pas || null,
      poNo: r.po_no || null,
      invDate: r.inv_date ? new Date(r.inv_date) : null,
      depNo: r.dep_no || null,
      depDate: r.dep_date ? new Date(r.dep_date) : null,
      check1: r.check1 || null,
      check2: r.check2 || null,
      invoiced,
      invoiceCredits,
      totalInvoiced,
      unloadingFee,
      adjustments,
      amountPaid,
      balanceDue,
      memo: r.memo || null,
      voucherId: r.voucher_id || null,
      airtableVoucherId: r.at_voucher_id || null,
    };

    const custKey = r.customer_code;
    if (!customerMap.has(custKey)) {
      customerMap.set(custKey, {
        customerCode: r.customer_code,
        customerName: r.customer_name,
        invoiced: 0, invoiceCredits: 0, totalInvoiced: 0,
        unloadingFee: 0, adjustments: 0, amountPaid: 0, balanceDue: 0,
        rowCount: 0, rows: [],
      });
    }
    const cust = customerMap.get(custKey)!;
    cust.rows.push(arRow);
    cust.invoiced += invoiced;
    cust.invoiceCredits += invoiceCredits;
    cust.totalInvoiced += totalInvoiced;
    cust.unloadingFee += unloadingFee;
    cust.adjustments += adjustments;
    cust.amountPaid += amountPaid;
    cust.balanceDue += balanceDue;
    cust.rowCount++;
  }

  const customers = Array.from(customerMap.values()).sort((a, b) =>
    a.customerCode.localeCompare(b.customerCode)
  );

  const grandTotals = customers.reduce(
    (acc, c) => ({
      invoiced: acc.invoiced + c.invoiced,
      invoiceCredits: acc.invoiceCredits + c.invoiceCredits,
      totalInvoiced: acc.totalInvoiced + c.totalInvoiced,
      unloadingFee: acc.unloadingFee + c.unloadingFee,
      adjustments: acc.adjustments + c.adjustments,
      amountPaid: acc.amountPaid + c.amountPaid,
      balanceDue: acc.balanceDue + c.balanceDue,
    }),
    { invoiced: 0, invoiceCredits: 0, totalInvoiced: 0, unloadingFee: 0, adjustments: 0, amountPaid: 0, balanceDue: 0 }
  );

  return { reportDate: asOfDate, customers, grandTotals };
}

export async function buildManualARReport(
  options: {
    asOfDate?: Date;
    customerCodes?: string[];
    includeZeroBalance?: boolean;
  } = {}
): Promise<ARReport> {
  const { asOfDate = new Date(), customerCodes, includeZeroBalance = true } = options;
  const params: unknown[] = [];
  const whereParts = [`entry_status <> 'void'`];

  if (customerCodes?.length) {
    params.push(customerCodes.map(code => code.toUpperCase()));
    whereParts.push(`customer_code = ANY($${params.length})`);
  }

  params.push(asOfDate);
  whereParts.push(`(inv_date IS NULL OR inv_date <= $${params.length})`);

  const rows = await query<{
    id: string;
    customer_code: string;
    customer_name: string | null;
    division: string | null;
    lot_no: string | null;
    r_no: string | null;
    misc_pas: string | null;
    po_no: string | null;
    inv_date: string | null;
    dep_no: string | null;
    dep_date: string | null;
    check1: string | null;
    check2: string | null;
    invoiced: string;
    invoice_credits: string;
    total_invoiced: string;
    unloading_fee: string;
    adjustments: string;
    amount_paid: string;
    balance_due: string;
    memo: string | null;
  }>(`
    SELECT
      id, customer_code, customer_name, division, lot_no, r_no, misc_pas,
      po_no, inv_date::text, dep_no, dep_date::text, check1, check2,
      invoiced::text, invoice_credits::text, total_invoiced::text,
      unloading_fee::text, adjustments::text, amount_paid::text,
      balance_due::text, memo
    FROM ar_manual_entries
    WHERE ${whereParts.join(' AND ')}
    ORDER BY customer_code, inv_date NULLS LAST, lot_no, r_no, created_at
  `, params);

  const customerMap = new Map<string, CustomerARTotal>();

  for (const r of rows) {
    const invoiced = Number(r.invoiced || 0);
    const invoiceCredits = Number(r.invoice_credits || 0);
    const totalInvoiced = Number(r.total_invoiced || computeTotalInvoiced(invoiced, invoiceCredits));
    const unloadingFee = Number(r.unloading_fee || 0);
    const adjustments = Number(r.adjustments || 0);
    const amountPaid = Number(r.amount_paid || 0);
    const balanceDue = Number(r.balance_due || computeBalanceDue(totalInvoiced, unloadingFee, adjustments, amountPaid));

    if (!includeZeroBalance && Math.abs(balanceDue) < 0.01 && Math.abs(invoiced) < 0.01) continue;

    const customerCode = r.customer_code || 'UNKNOWN';
    const customerName = r.customer_name || customerCode;
    const arRow: ARRow = {
      customerId: customerCode,
      customerCode,
      customerName,
      division: r.division,
      lotNo: r.lot_no,
      rNo: r.r_no,
      miscPas: r.misc_pas,
      poNo: r.po_no,
      invDate: r.inv_date ? new Date(r.inv_date) : null,
      depNo: r.dep_no,
      depDate: r.dep_date ? new Date(r.dep_date) : null,
      check1: r.check1,
      check2: r.check2,
      invoiced,
      invoiceCredits,
      totalInvoiced,
      unloadingFee,
      adjustments,
      amountPaid,
      balanceDue,
      memo: r.memo,
      voucherId: r.id,
      airtableVoucherId: null,
    };

    if (!customerMap.has(customerCode)) {
      customerMap.set(customerCode, {
        customerCode,
        customerName,
        invoiced: 0,
        invoiceCredits: 0,
        totalInvoiced: 0,
        unloadingFee: 0,
        adjustments: 0,
        amountPaid: 0,
        balanceDue: 0,
        rowCount: 0,
        rows: [],
      });
    }

    const customer = customerMap.get(customerCode)!;
    customer.rows.push(arRow);
    customer.invoiced += invoiced;
    customer.invoiceCredits += invoiceCredits;
    customer.totalInvoiced += totalInvoiced;
    customer.unloadingFee += unloadingFee;
    customer.adjustments += adjustments;
    customer.amountPaid += amountPaid;
    customer.balanceDue += balanceDue;
    customer.rowCount++;
  }

  const customers = Array.from(customerMap.values()).sort((a, b) =>
    a.customerCode.localeCompare(b.customerCode)
  );

  const grandTotals = customers.reduce(
    (acc, customer) => ({
      invoiced: acc.invoiced + customer.invoiced,
      invoiceCredits: acc.invoiceCredits + customer.invoiceCredits,
      totalInvoiced: acc.totalInvoiced + customer.totalInvoiced,
      unloadingFee: acc.unloadingFee + customer.unloadingFee,
      adjustments: acc.adjustments + customer.adjustments,
      amountPaid: acc.amountPaid + customer.amountPaid,
      balanceDue: acc.balanceDue + customer.balanceDue,
    }),
    { invoiced: 0, invoiceCredits: 0, totalInvoiced: 0, unloadingFee: 0, adjustments: 0, amountPaid: 0, balanceDue: 0 }
  );

  return { reportDate: asOfDate, customers, grandTotals };
}

// Fallback: build from denormalized voucher amounts when transaction join yields nothing
async function buildARFromVoucherAmounts(
  options: { customerCodes?: string[]; includeZeroBalance?: boolean }
) {
  const { customerCodes, includeZeroBalance = true } = options;

  const sql = `
    SELECT
      v.id as voucher_id,
      v.airtable_record_id as at_voucher_id,
      v.lot_no, v.r_no, v.reference2 as po_no, v.via_free_entry as misc_pas,
      v.memo, v.accrue_date as inv_date, v.dep_no, v.dep_date,
      v.ck_no as check1, v.ck_no2 as check2, v.division,
      c.id as customer_id, c.code as customer_code,
      COALESCE(c.entity_company_name, c.name) as customer_name,
      v.invoiced_amount as invoiced,
      v.invoice_credits,
      v.unloading_fee, v.adjustments, v.amount_paid
    FROM vouchers v
    JOIN contacts c ON c.id = v.issued_contact_id
    WHERE v.deleted_at IS NULL
      AND c.is_customer = true
      AND (v.invoiced_amount > 0 OR v.amount_paid > 0 OR v.debit > 0)
      ${customerCodes?.length ? `AND c.code = ANY($1)` : ''}
    ORDER BY c.code, v.accrue_date, v.lot_no
  `;

  const params = customerCodes?.length ? [customerCodes] : [];
  return query(sql, params);
}

// ============================================================
// EXCEL EXPORT - matching legacy layout
// ============================================================
export async function exportARToExcel(report: ARReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MelonBook';
  wb.created = new Date();

  const ws = wb.addWorksheet('2026 AR Report  ', {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 5,
      horizontalCentered: true,
    },
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0, topLeftCell: 'A4' }],
  });

  ws.pageSetup.margins = {
    left: 0.16,
    right: 0,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3,
  };
  ws.headerFooter.oddHeader = '&LPage #&P&C RAYMON J. LAND INC. ACCOUNTS RECEIVABLE 2026                                                                &D';

  const cols: Partial<ExcelJS.Column>[] = [
    { key: 'custId',         width: 7.29  },
    { key: 'div',            width: 3.71  },
    { key: 'lotNo',          width: 5.57  },
    { key: 'rNo',            width: 5.57  },
    { key: 'misc',           width: 4.57  },
    { key: 'poNo',           width: 11.71 },
    { key: 'invDate',        width: 7.86  },
    { key: 'depNo',          width: 12.29 },
    { key: 'depDate',        width: 14.71 },
    { key: 'check1',         width: 12.57 },
    { key: 'check2',         width: 9.71  },
    { key: 'invoiced',       width: 14.14 },
    { key: 'invoiceCredits', width: 12.43 },
    { key: 'totalInvoiced',  width: 14.14 },
    { key: 'unloadingFee',   width: 11.86 },
    { key: 'adjustments',    width: 12.43 },
    { key: 'amountPaid',     width: 15.00 },
    { key: 'balanceDue',     width: 15.29 },
    { key: 'memo',           width: 21.71 },
  ];

  ws.columns = cols;
  ws.mergeCells('C1:Q1');
  ws.mergeCells('C2:Q2');
  ws.getRow(1).height = 22.5;
  ws.getRow(2).height = 14.25;
  ws.getRow(3).height = 15.75;

  ws.getCell('R2').value = 'DATE ';
  ws.getCell('S2').value = report.reportDate;
  ws.getCell('R2').font = { name: 'Calibri', size: 9, bold: true };
  ws.getCell('S2').font = { name: 'Calibri', size: 9, bold: true };
  ws.getCell('R2').numFmt = 'mm-dd-yy';
  ws.getCell('S2').numFmt = 'mm-dd-yy';

  const headers = ['CUST ID','DIV.','Lot #','R #','MISC.','PO #','INV Date','Dep #','Dep Date','1st Check #','2nd Check #','Invoiced','Invoice Credits','Total Invoiced','Unloading Fee','Adjustments','Amount Paid','Balance Due','MEMO'];
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };
  const moneyAccounting = '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)';
  const numberRed = '#,##0.00_);[Red](#,##0.00)';
  const baseFont = { name: 'Calibri', size: 9 };

  const setHeaderRow = (rowNumber: number) => {
    const row = ws.getRow(rowNumber);
    row.values = headers;
    row.height = 15.75;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > 19) return;
      cell.font = { name: 'Calibri', size: colNumber === 2 ? 8 : 9, bold: true };
      cell.border = thinBorder;
      cell.alignment = {
        horizontal: [5, 6, 7, 8, 9].includes(colNumber) ? (colNumber === 5 ? 'center' : 'left') : undefined,
        vertical: 'middle',
      };
      if (colNumber === 6) cell.numFmt = '@';
      if ([7, 9].includes(colNumber)) cell.numFmt = 'm/d/yy';
      if ([12, 18, 19].includes(colNumber)) cell.numFmt = moneyAccounting;
      if ([13, 14, 15, 16, 17].includes(colNumber)) cell.numFmt = numberRed;
    });
  };

  const styleDataRow = (rowNumber: number) => {
    const row = ws.getRow(rowNumber);
    row.height = 14.25;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > 19) return;
      cell.font = { ...baseFont, size: colNumber === 2 || colNumber === 9 ? 8 : 9 };
      cell.border = thinBorder;
      cell.alignment = {
        horizontal: [5].includes(colNumber) ? 'center' : undefined,
        vertical: 'middle',
      };
      if (colNumber === 6) cell.numFmt = '@';
      if ([7, 9].includes(colNumber)) cell.numFmt = 'm/d/yy';
      if ([12, 18, 19].includes(colNumber)) cell.numFmt = moneyAccounting;
      if ([13, 14, 15, 16, 17].includes(colNumber)) cell.numFmt = numberRed;
    });
  };

  setHeaderRow(3);
  let currentRow = 4;
  const totalRows: number[] = [];
  for (const cust of report.customers) {
    const customerRow = ws.getRow(currentRow);
    customerRow.height = 14.25;
    customerRow.getCell(1).value = 'Cust ID:';
    customerRow.getCell(3).value = cust.customerCode;
    if (cust.customerCode === 'FOOLIO') customerRow.getCell(4).value = '(Need BOL)';
    customerRow.getCell(7).value = cust.customerName;
    customerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > 19) return;
      cell.font = { name: 'Calibri', size: colNumber === 7 ? 12 : 9, bold: colNumber === 7 };
      cell.border = thinBorder;
      if ([7, 9].includes(colNumber)) cell.numFmt = 'm/d/yy';
    });
    currentRow++;

    setHeaderRow(currentRow);
    currentRow++;
    const dataStartRow = currentRow;

    for (const row of cust.rows) {
      const dataRow = ws.getRow(currentRow);
      dataRow.values = [
        row.customerCode,
        row.division || '',
        row.lotNo || '',
        row.rNo || '',
        row.miscPas || '',
        row.poNo || '',
        row.invDate,
        row.depNo || '',
        row.depDate,
        row.check1 || '',
        row.check2 || '',
        row.invoiced,
        row.invoiceCredits || '',
        { formula: `+L${currentRow}+M${currentRow}`, result: row.totalInvoiced },
        row.unloadingFee || '',
        row.adjustments || '',
        row.amountPaid || '',
        { formula: `+N${currentRow}+O${currentRow}+P${currentRow}-Q${currentRow}`, result: row.balanceDue },
        row.memo || '',
      ];
      styleDataRow(currentRow);
      if (String(row.miscPas || '').toUpperCase().includes('REJ')) {
        dataRow.getCell(3).font = { name: 'Calibri', size: 9, color: { argb: 'FFC00000' } };
        dataRow.getCell(5).font = { name: 'Calibri', size: 9, color: { argb: 'FFC00000' } };
      }
      currentRow++;
    }

    const dataEndRow = Math.max(dataStartRow, currentRow - 1);

    // Customer total row
    const totRow = ws.getRow(currentRow);
    totRow.height = 15.75;
    totRow.getCell(7).value = cust.customerName;
    totRow.getCell(10).value = 'TOTAL:';
    totRow.getCell(12).value = { formula: `SUM(L${dataStartRow}:L${dataEndRow})`, result: cust.invoiced };
    totRow.getCell(13).value = { formula: `SUM(M${dataStartRow}:M${dataEndRow})`, result: cust.invoiceCredits };
    totRow.getCell(14).value = { formula: `SUM(N${dataStartRow}:N${dataEndRow})`, result: cust.totalInvoiced };
    totRow.getCell(15).value = { formula: `SUM(O${dataStartRow}:O${dataEndRow})`, result: cust.unloadingFee };
    totRow.getCell(16).value = { formula: `SUM(P${dataStartRow}:P${dataEndRow})`, result: cust.adjustments };
    totRow.getCell(17).value = { formula: `SUM(Q${dataStartRow}:Q${dataEndRow})`, result: cust.amountPaid };
    totRow.getCell(18).value = { formula: `SUM(R${dataStartRow}:R${dataEndRow})`, result: cust.balanceDue };
    totRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > 19) return;
      cell.font = { name: 'Calibri', size: 9, bold: true };
      cell.border = thinBorder;
      if ([12, 18, 19].includes(colNumber)) cell.numFmt = moneyAccounting;
      if ([13, 14, 15, 16, 17].includes(colNumber)) cell.numFmt = numberRed;
    });
    totalRows.push(currentRow);
    currentRow += 3;
  }

  if (report.customers.length > 1) {
    const gtRow = ws.getRow(currentRow);
    gtRow.height = 15.75;
    gtRow.getCell(7).value = 'GRAND TOTALS';
    gtRow.getCell(10).value = 'TOTAL:';
    for (const col of [12, 13, 14, 15, 16, 17, 18]) {
      const letter = ws.getColumn(col).letter;
      gtRow.getCell(col).value = {
        formula: totalRows.map(rowNumber => `${letter}${rowNumber}`).join('+'),
        result: col === 12 ? report.grandTotals.invoiced :
          col === 13 ? report.grandTotals.invoiceCredits :
          col === 14 ? report.grandTotals.totalInvoiced :
          col === 15 ? report.grandTotals.unloadingFee :
          col === 16 ? report.grandTotals.adjustments :
          col === 17 ? report.grandTotals.amountPaid :
          report.grandTotals.balanceDue,
      };
    }
    gtRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > 19) return;
      cell.font = { name: 'Calibri', size: 9, bold: true };
      cell.border = thinBorder;
      if ([12, 18, 19].includes(colNumber)) cell.numFmt = moneyAccounting;
      if ([13, 14, 15, 16, 17].includes(colNumber)) cell.numFmt = numberRed;
    });
  }

  ws.getColumn(6).numFmt = '@';

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

// ============================================================
// PDF EXPORT - print-ready legacy AR layout
// ============================================================
type PdfPage = { content: string[] };

type PdfTextOptions = {
  size?: number;
  color?: string;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
};

function pdfEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function pdfColor(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function truncateForPdf(value: unknown, width: number, fontSize: number) {
  const text = String(value ?? '');
  const maxChars = Math.max(1, Math.floor(width / (fontSize * 0.48)));
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 3))}...` : text;
}

function formatPdfMoney(value: number, blankZero = false) {
  if (blankZero && Number(value || 0) === 0) return '';
  const amount = Math.abs(Number(value || 0));
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
  return Number(value || 0) < 0 ? `(${formatted})` : formatted;
}

function formatPdfDate(value: Date | string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
}

class SimplePdf {
  readonly width = 1008; // Legal landscape: 14in x 8.5in
  readonly height = 612;
  readonly margin = 24;
  readonly pages: PdfPage[] = [];
  private currentPage: PdfPage | null = null;
  private pageNo = 0;

  addPage(title: string, subtitle: string) {
    this.pageNo++;
    this.currentPage = { content: [] };
    this.pages.push(this.currentPage);

    this.rect(this.margin, 18, this.width - this.margin * 2, 26, '#0D1A0A');
    this.text(title, this.margin + 8, 35, this.width - this.margin * 2 - 16, {
      size: 12,
      color: '#F5F0E8',
      align: 'center',
      bold: true,
    });
    this.text(subtitle, this.margin, 56, this.width - this.margin * 2, {
      size: 7,
      color: '#2D4A22',
      align: 'center',
    });
    this.text(`Page ${this.pageNo}`, this.width - this.margin - 70, this.height - 14, 70, {
      size: 7,
      color: '#2D4A22',
      align: 'right',
    });
  }

  private add(op: string) {
    if (!this.currentPage) throw new Error('PDF page not initialized');
    this.currentPage.content.push(op);
  }

  y(top: number) {
    return this.height - top;
  }

  rect(x: number, top: number, w: number, h: number, fill: string, stroke?: string) {
    const fillColor = pdfColor(fill);
    const y = this.y(top + h);
    this.add(`q ${fillColor} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
    if (stroke) {
      const strokeColor = pdfColor(stroke);
      this.add(`q ${strokeColor} RG 0.35 w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`);
    }
  }

  line(x1: number, top1: number, x2: number, top2: number, color = '#E8E0CC', width = 0.25) {
    const strokeColor = pdfColor(color);
    this.add(`q ${strokeColor} RG ${width} w ${x1.toFixed(2)} ${this.y(top1).toFixed(2)} m ${x2.toFixed(2)} ${this.y(top2).toFixed(2)} l S Q`);
  }

  text(value: unknown, x: number, baselineTop: number, width: number, options: PdfTextOptions = {}) {
    const size = options.size ?? 7;
    const color = pdfColor(options.color || '#0D1A0A');
    const safe = truncateForPdf(value, width, size);
    const approxWidth = String(safe).length * size * 0.48;
    let tx = x;
    if (options.align === 'right') tx = x + width - approxWidth;
    if (options.align === 'center') tx = x + (width - approxWidth) / 2;
    const ty = this.y(baselineTop);
    const font = options.bold ? '/F2' : '/F1';
    this.add(`BT ${font} ${size} Tf ${color} rg ${tx.toFixed(2)} ${ty.toFixed(2)} Td (${pdfEscape(safe)}) Tj ET`);
  }

  toBuffer() {
    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

    const kids: string[] = [];
    let nextObjectId = 5;

    for (const page of this.pages) {
      const pageObjectId = nextObjectId++;
      const contentObjectId = nextObjectId++;
      kids.push(`${pageObjectId} 0 R`);
      const stream = page.content.join('\n');
      objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
      objects[contentObjectId] = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
    }

    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${this.pages.length} >>`;

    let body = '%PDF-1.4\n';
    const offsets = [0];
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = Buffer.byteLength(body, 'utf8');
      body += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(body, 'utf8');
    body += `xref\n0 ${objects.length}\n`;
    body += '0000000000 65535 f \n';
    for (let i = 1; i < objects.length; i++) {
      body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(body, 'utf8');
  }
}

export async function exportARToPdf(report: ARReport): Promise<Buffer> {
  const pdf = new SimplePdf();
  const title = 'RAYMON J. LAND WATERMELON SALES - 2026 ACCOUNTS RECEIVABLE';
  const subtitle = `DATE: ${report.reportDate.toLocaleDateString('en-US')}  |  Formulas: Total Invoiced = Invoiced + Invoice Credits; Balance Due = Total Invoiced + Unloading Fee + Adjustments - Amount Paid`;

  const columns = [
    { label: 'CUST ID', width: 42, key: (r: ARRow) => r.customerCode },
    { label: 'DIV.', width: 28, key: (r: ARRow) => r.division || '' },
    { label: 'Lot #', width: 35, key: (r: ARRow) => r.lotNo || '' },
    { label: 'R #', width: 35, key: (r: ARRow) => r.rNo || '' },
    { label: 'MISC.', width: 36, key: (r: ARRow) => r.miscPas || '' },
    { label: 'PO #', width: 45, key: (r: ARRow) => r.poNo || '' },
    { label: 'INV Date', width: 45, key: (r: ARRow) => formatPdfDate(r.invDate) },
    { label: 'Dep #', width: 42, key: (r: ARRow) => r.depNo || '' },
    { label: 'Dep Date', width: 45, key: (r: ARRow) => formatPdfDate(r.depDate) },
    { label: '1st Check #', width: 50, key: (r: ARRow) => r.check1 || '' },
    { label: '2nd Check #', width: 50, key: (r: ARRow) => r.check2 || '' },
    { label: 'Invoiced', width: 60, key: (r: ARRow) => formatPdfMoney(r.invoiced), align: 'right' as const },
    { label: 'Invoice Credits', width: 60, key: (r: ARRow) => formatPdfMoney(r.invoiceCredits, true), align: 'right' as const },
    { label: 'Total Invoiced', width: 60, key: (r: ARRow) => formatPdfMoney(r.totalInvoiced), align: 'right' as const },
    { label: 'Unloading Fee', width: 55, key: (r: ARRow) => formatPdfMoney(r.unloadingFee, true), align: 'right' as const },
    { label: 'Adjustments', width: 55, key: (r: ARRow) => formatPdfMoney(r.adjustments, true), align: 'right' as const },
    { label: 'Amount Paid', width: 60, key: (r: ARRow) => formatPdfMoney(r.amountPaid), align: 'right' as const },
    { label: 'Balance Due', width: 60, key: (r: ARRow) => formatPdfMoney(r.balanceDue), align: 'right' as const },
    { label: 'MEMO', width: 92, key: (r: ARRow) => r.memo || '' },
  ];

  const startX = pdf.margin;
  const rowHeight = 14;
  const headerHeight = 16;
  const customerHeight = 17;
  let y = 70;

  function ensureSpace(height: number) {
    if (pdf.pages.length === 0 || y + height > pdf.height - 28) {
      pdf.addPage(title, subtitle);
      y = 70;
    }
  }

  function drawColumnHeader() {
    let x = startX;
    pdf.rect(startX, y, pdf.width - pdf.margin * 2, headerHeight, '#2D4A22', '#7AAD5E');
    for (const col of columns) {
      pdf.text(col.label, x + 2, y + 10.5, col.width - 4, {
        size: col.label.length > 10 ? 5.3 : 6,
        color: '#F5F0E8',
        bold: true,
        align: col.align || 'center',
      });
      pdf.line(x, y, x, y + headerHeight, '#7AAD5E');
      x += col.width;
    }
    pdf.line(x, y, x, y + headerHeight, '#7AAD5E');
    y += headerHeight;
  }

  function drawDataRow(row: ARRow, stripe: boolean) {
    let x = startX;
    if (stripe) pdf.rect(startX, y, pdf.width - pdf.margin * 2, rowHeight, '#F5F0E8');
    for (const col of columns) {
      const isBalance = col.label === 'Balance Due';
      pdf.text(col.key(row), x + 2, y + 9.3, col.width - 4, {
        size: 5.8,
        color: isBalance && row.balanceDue > 0 ? '#C0392B' : '#0D1A0A',
        bold: isBalance && row.balanceDue > 0,
        align: col.align || 'left',
      });
      x += col.width;
    }
    pdf.line(startX, y + rowHeight, pdf.width - pdf.margin, y + rowHeight, '#E8E0CC', 0.2);
    y += rowHeight;
  }

  function drawCustomerTotal(customer: CustomerARTotal) {
    pdf.rect(startX, y, pdf.width - pdf.margin * 2, rowHeight + 2, '#E8C547', '#D4A820');
    pdf.text(customer.customerName, startX + 221, y + 10, 180, { size: 6.8, color: '#0D1A0A', bold: true });
    pdf.text('TOTAL:', startX + 403, y + 10, 45, { size: 6.8, color: '#0D1A0A', bold: true, align: 'right' });

    const totalValues = [
      { x: 453, value: customer.invoiced },
      { x: 513, value: customer.invoiceCredits },
      { x: 573, value: customer.totalInvoiced },
      { x: 633, value: customer.unloadingFee },
      { x: 688, value: customer.adjustments },
      { x: 743, value: customer.amountPaid },
      { x: 803, value: customer.balanceDue },
    ];

    for (const total of totalValues) {
      pdf.text(formatPdfMoney(total.value, false), startX + total.x, y + 10, 58, {
        size: 6.8,
        color: '#0D1A0A',
        bold: true,
        align: 'right',
      });
    }
    y += rowHeight + 8;
  }

  for (const customer of report.customers) {
    ensureSpace(customerHeight + headerHeight + Math.min(customer.rows.length, 2) * rowHeight + rowHeight + 8);
    pdf.rect(startX, y, pdf.width - pdf.margin * 2, customerHeight, '#1A2216', '#2D4A22');
    pdf.text('Cust ID:', startX + 6, y + 11, 42, { size: 7, color: '#F5F0E8', bold: true });
    pdf.text(customer.customerCode, startX + 52, y + 11, 72, { size: 8, color: '#7AAD5E', bold: true });
    pdf.text(customer.customerName, startX + 150, y + 11, 330, { size: 8, color: '#F5F0E8', bold: true });
    pdf.text(`${customer.rowCount} row(s)`, pdf.width - pdf.margin - 100, y + 11, 95, {
      size: 7,
      color: '#E8E0CC',
      align: 'right',
    });
    y += customerHeight;
    drawColumnHeader();

    customer.rows.forEach((row, index) => {
      ensureSpace(rowHeight + rowHeight + 8);
      drawDataRow(row, index % 2 === 0);
    });
    ensureSpace(rowHeight + 12);
    drawCustomerTotal(customer);
  }

  ensureSpace(30);
  pdf.rect(startX, y, pdf.width - pdf.margin * 2, 22, '#E8C547', '#D4A820');
  pdf.text('GRAND TOTALS', startX + 10, y + 14, 180, {
    size: 10,
    color: '#0D1A0A',
    bold: true,
  });
  const grandValues = [
    { label: 'Invoiced', x: 453, value: report.grandTotals.invoiced },
    { label: 'Credits', x: 513, value: report.grandTotals.invoiceCredits },
    { label: 'Total Inv', x: 573, value: report.grandTotals.totalInvoiced },
    { label: 'Unload', x: 633, value: report.grandTotals.unloadingFee },
    { label: 'Adj', x: 688, value: report.grandTotals.adjustments },
    { label: 'Paid', x: 743, value: report.grandTotals.amountPaid },
    { label: 'Balance', x: 803, value: report.grandTotals.balanceDue },
  ];
  for (const item of grandValues) {
    pdf.text(item.label, startX + item.x, y + 8, 58, { size: 5.4, color: '#0D1A0A', bold: true, align: 'right' });
    pdf.text(formatPdfMoney(item.value), startX + item.x, y + 17, 58, { size: 7, color: '#0D1A0A', bold: true, align: 'right' });
  }

  if (report.customers.length === 0) {
    ensureSpace(40);
    pdf.text('No AR data found. Run Airtable sync or add AR entries, then export again.', startX, y + 18, 520, {
      size: 10,
      color: '#C0392B',
      bold: true,
    });
  }

  return pdf.toBuffer();
}

// ============================================================
// AR SUMMARY STATS
// ============================================================
export async function getARSummary(): Promise<{
  totalInvoiced: number;
  totalPaid: number;
  totalBalance: number;
  customerCount: number;
  openInvoiceCount: number;
  overdueCount: number;
}> {
  const [row] = await query<{
    total_invoiced: number;
    total_paid: number;
    total_balance: number;
    customer_count: number;
    open_invoice_count: number;
    overdue_count: number;
  }>(`
    SELECT
      COALESCE(SUM(total_invoiced), 0) as total_invoiced,
      COALESCE(SUM(amount_paid), 0) as total_paid,
      COALESCE(SUM(balance_due), 0) as total_balance,
      COUNT(DISTINCT customer_code) as customer_count,
      COUNT(*) FILTER (WHERE balance_due > 0) as open_invoice_count,
      COUNT(*) FILTER (WHERE balance_due > 0 AND inv_date < NOW() - INTERVAL '30 days') as overdue_count
    FROM ar_report_cache
    WHERE report_date = (SELECT MAX(report_date) FROM ar_report_cache)
  `);

  // Fallback to live computation if cache empty
  if (!row || Number(row.total_invoiced) === 0) {
    const [live] = await query<{
      total_invoiced: number; total_paid: number;
    }>(`
      SELECT
        COALESCE(SUM(CASE WHEN account_no = 1152 THEN debit ELSE 0 END), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN account_no = 1122 THEN credit ELSE 0 END), 0) as total_paid
      FROM transactions WHERE deleted_at IS NULL
    `);
    return {
      totalInvoiced: Number(live?.total_invoiced || 0),
      totalPaid: Number(live?.total_paid || 0),
      totalBalance: Number(live?.total_invoiced || 0) - Number(live?.total_paid || 0),
      customerCount: 0, openInvoiceCount: 0, overdueCount: 0,
    };
  }

  return {
    totalInvoiced: Number(row.total_invoiced),
    totalPaid: Number(row.total_paid),
    totalBalance: Number(row.total_balance),
    customerCount: Number(row.customer_count),
    openInvoiceCount: Number(row.open_invoice_count),
    overdueCount: Number(row.overdue_count),
  };
}

// ============================================================
// RAW AIRTABLE MIRROR SUMMARY
// ============================================================
export async function getMirrorARSummary(): Promise<{
  transactionRecordCount: number;
  ar1152RecordCount: number;
  paid1122RecordCount: number;
  invoicedFromRecords: number;
  paidFromRecords: number;
  invoicedFromViews: number;
  paidFromViews: number;
  balanceFromViews: number;
  viewStats: Array<{
    viewName: string;
    recordCount: number;
    debitTotal: number;
    creditTotal: number;
    lastSyncedAt: string;
    syncError: string | null;
  }>;
}> {
  const [recordTotals] = await query<{
    transaction_record_count: string;
    ar1152_record_count: string;
    paid1122_record_count: string;
    invoiced_from_records: string;
    paid_from_records: string;
  }>(`
    WITH tx AS (
      SELECT
        raw_fields,
        COALESCE(raw_fields->>'Trans #', raw_fields->>'Transaction #', raw_fields->>'Name', '') as trans_no,
        COALESCE(raw_fields->>'Account No', raw_fields->>'Account', '') as account_no,
        CASE
          WHEN COALESCE(raw_fields->>'Debit', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$'
            THEN REPLACE(raw_fields->>'Debit', ',', '')::numeric
          ELSE 0
        END as debit,
        CASE
          WHEN COALESCE(raw_fields->>'Credit', '') ~ '^-?[0-9,]+(\\.[0-9]+)?$'
            THEN REPLACE(raw_fields->>'Credit', ',', '')::numeric
          ELSE 0
        END as credit
      FROM airtable_records
      WHERE table_id = $1
    )
    SELECT
      COUNT(*)::text as transaction_record_count,
      COUNT(*) FILTER (
        WHERE trans_no ILIKE '%1152%' OR account_no ILIKE '%1152%'
      )::text as ar1152_record_count,
      COUNT(*) FILTER (
        WHERE trans_no ILIKE '%1122%' OR account_no ILIKE '%1122%'
      )::text as paid1122_record_count,
      COALESCE(SUM(debit) FILTER (
        WHERE trans_no ILIKE '%1152%' OR account_no ILIKE '%1152%'
      ), 0)::text as invoiced_from_records,
      COALESCE(SUM(credit) FILTER (
        WHERE trans_no ILIKE '%1122%' OR account_no ILIKE '%1122%'
      ), 0)::text as paid_from_records
    FROM tx
  `, [TRANSACTIONS_TABLE_ID]);

  const viewRows = await query<{
    view_name: string;
    record_count: number;
    debit_total: string;
    credit_total: string;
    last_synced_at: string;
    sync_error: string | null;
  }>(`
    SELECT view_name, record_count, debit_total::text, credit_total::text, last_synced_at, sync_error
    FROM airtable_view_stats
    WHERE table_id = $1
      AND (
        view_name ILIKE '%1152%'
        OR view_name ILIKE '%1122%'
        OR view_name ILIKE 'ACCTG%'
      )
    ORDER BY view_name
  `, [TRANSACTIONS_TABLE_ID]);

  const viewStats = viewRows.map(row => ({
    viewName: row.view_name,
    recordCount: Number(row.record_count || 0),
    debitTotal: Number(row.debit_total || 0),
    creditTotal: Number(row.credit_total || 0),
    lastSyncedAt: row.last_synced_at,
    syncError: row.sync_error,
  }));

  const invoiceView = viewStats.find(view => view.viewName.includes('1152'));
  const paidView = viewStats.find(view => view.viewName.includes('1122'));
  const invoicedFromViews = invoiceView ? invoiceView.debitTotal || invoiceView.creditTotal : 0;
  const paidFromViews = paidView ? paidView.creditTotal || paidView.debitTotal : 0;

  return {
    transactionRecordCount: Number(recordTotals?.transaction_record_count || 0),
    ar1152RecordCount: Number(recordTotals?.ar1152_record_count || 0),
    paid1122RecordCount: Number(recordTotals?.paid1122_record_count || 0),
    invoicedFromRecords: Number(recordTotals?.invoiced_from_records || 0),
    paidFromRecords: Number(recordTotals?.paid_from_records || 0),
    invoicedFromViews,
    paidFromViews,
    balanceFromViews: invoicedFromViews - paidFromViews,
    viewStats,
  };
}
