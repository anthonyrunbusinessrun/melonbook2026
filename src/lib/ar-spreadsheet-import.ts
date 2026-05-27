import * as XLSX from 'xlsx';

export type ParsedAREntry = {
  arYear: number;
  entryStatus: 'draft' | 'posted' | 'void';
  customerCode: string;
  customerName: string | null;
  division: string | null;
  lotNo: string | null;
  rNo: string | null;
  miscPas: string | null;
  poNo: string | null;
  invDate: string | null;
  depNo: string | null;
  depDate: string | null;
  check1: string | null;
  check2: string | null;
  invoiced: number;
  invoiceCredits: number;
  unloadingFee: number;
  adjustments: number;
  amountPaid: number;
  memo: string | null;
};

export type ImportPreview = {
  sheetName: string;
  entries: ParsedAREntry[];
  warnings: string[];
};

function text(value: unknown) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function money(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  const negative = raw.startsWith('(') && raw.endsWith(')');
  const parsed = Number(raw.replace(/[$,\s()]/g, ''));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function dateToIso(value: unknown) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return date.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw || raw === '-') return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const date = new Date(Date.UTC(year, Number(slash[1]) - 1, Number(slash[2])));
    return date.toISOString().slice(0, 10);
  }

  return null;
}

function isHeaderRow(row: unknown[]) {
  const normalized = row.slice(0, 19).map(normalizeHeader);
  return normalized.includes('custid') &&
    normalized.includes('lot') &&
    normalized.includes('balancedue');
}

function isTotalRow(row: unknown[]) {
  return row.some(value => String(value ?? '').toLowerCase().includes('total:'));
}

function hasUsefulData(row: unknown[]) {
  return row.slice(0, 19).some(value => String(value ?? '').trim() !== '');
}

function looksLikeAmountOrReference(row: unknown[]) {
  return row.slice(2, 18).some(value => String(value ?? '').trim() !== '');
}

function chooseSheet(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.find(name => /2026.*ar.*report/i.test(name)) ||
    workbook.SheetNames.find(name => /ar.*report/i.test(name)) ||
    workbook.SheetNames[0];
}

function parseCustomerSection(row: unknown[]) {
  const firstCell = String(row[0] ?? '').toLowerCase();
  if (!firstCell.includes('cust id')) return null;

  return {
    code: text(row[3] || row[1] || row[2])?.toUpperCase() || null,
    name: text(row[6] || row[4] || row[5]),
  };
}

function rowToEntry(row: unknown[], customerCode: string | null, customerName: string | null, index: number) {
  const code = (text(row[0]) || customerCode || '').toUpperCase();
  if (!code) return { entry: null, warning: `Row ${index + 1}: skipped because customer code is blank.` };
  if (!looksLikeAmountOrReference(row)) return { entry: null, warning: null };

  const invoiced = money(row[11]);
  const invoiceCredits = money(row[12]);
  const unloadingFee = money(row[14]);
  const adjustments = money(row[15]);
  const amountPaid = money(row[16]);
  const hasAmounts = [invoiced, invoiceCredits, unloadingFee, adjustments, amountPaid].some(value => Math.abs(value) > 0.001);
  const hasIdentifiers = [row[2], row[3], row[5], row[6], row[7], row[10]].some(value => String(value ?? '').trim());
  if (!hasAmounts && !hasIdentifiers) return { entry: null, warning: null };

  const entry: ParsedAREntry = {
    arYear: 2026,
    entryStatus: 'draft',
    customerCode: code,
    customerName: text(row[0]) && text(row[0]) !== customerCode ? null : customerName,
    division: text(row[1])?.toUpperCase() || null,
    lotNo: text(row[2]),
    rNo: text(row[3]),
    miscPas: text(row[4])?.toUpperCase() || null,
    poNo: text(row[5]),
    invDate: dateToIso(row[6]),
    depNo: text(row[7]),
    depDate: dateToIso(row[8]),
    check1: text(row[9]),
    check2: text(row[10]),
    invoiced,
    invoiceCredits,
    unloadingFee,
    adjustments,
    amountPaid,
    memo: text(row[18]),
  };

  return { entry, warning: null };
}

export function parseARSpreadsheet(buffer: ArrayBuffer, filename: string): ImportPreview {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetName = chooseSheet(workbook);
  if (!sheetName) {
    return { sheetName: filename, entries: [], warnings: ['No sheets found in the uploaded file.'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  const entries: ParsedAREntry[] = [];
  let inTable = false;
  let customerCode: string | null = null;
  let customerName: string | null = null;

  rows.forEach((row, index) => {
    if (!hasUsefulData(row)) return;

    if (isHeaderRow(row)) {
      inTable = true;
      return;
    }

    const customer = parseCustomerSection(row);
    if (customer) {
      customerCode = customer.code;
      customerName = customer.name;
      return;
    }

    if (!inTable || isTotalRow(row)) return;

    const { entry, warning } = rowToEntry(row, customerCode, customerName, index);
    if (entry) entries.push(entry);
    if (warning) warnings.push(warning);
  });

  if (entries.length === 0) {
    warnings.push('No importable AR rows were found. The importer expects the legacy A-S columns: Cust ID through Memo.');
  }

  return { sheetName, entries, warnings: warnings.slice(0, 50) };
}
