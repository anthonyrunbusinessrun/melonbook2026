export const dynamic = "force-dynamic";
import { buildARReport, exportARToExcel } from '@/lib/ar-engine';
import { getMirrorARSummary } from '@/lib/ar-engine';
import { Download, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function fmt(n: number) {
  if (n === 0) return <span className="money-zero">$0.00</span>;
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(n));
  if (n < 0) return <span className="money-negative">({formatted})</span>;
  return <span className="money">{formatted}</span>;
}

function fmtDate(d: string | Date | null) {
  if (!d) return <span className="text-brand-warm/30">—</span>;
  return <span>{new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</span>;
}

export default async function ARReportPage({
  searchParams
}: {
  searchParams: Promise<{ customer?: string; showPaid?: string; date?: string }>
}) {
  const sp = await searchParams;
  const includeZeroBalance = sp.showPaid === 'true';
  const customerFilter = sp.customer ? sp.customer.split(',').map(s => s.trim()) : undefined;

  let report;
  let mirrorSummary: Awaited<ReturnType<typeof getMirrorARSummary>> | null = null;
  let error: string | null = null;
  let mirrorError: string | null = null;

  try {
    report = await buildARReport({
      asOfDate: sp.date ? new Date(sp.date) : new Date(),
      customerCodes: customerFilter,
      includeZeroBalance,
    });
  } catch (e) {
    error = (e as Error).message;
    report = null;
  }

  try {
    mirrorSummary = await getMirrorARSummary();
  } catch (e) {
    mirrorError = (e as Error).message;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">AR Report</h1>
          <p className="text-brand-sage/60 text-sm">
            Accounts Receivable — matches 2026 AR Spreadsheet layout
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/ar/export"
            className="btn-gold flex items-center gap-1.5 text-sm"
          >
            <Download size={14} />
            Export Excel
          </a>
          <Link href="/ar-report" className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} />
            Refresh
          </Link>
        </div>
      </div>

      {/* Airtable accounting validation */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-brand-cream">Airtable Accounting View Validation</h2>
            <p className="text-xs text-brand-sage/55 mt-1">
              Mirrors the Transaction tab views the accounting team uses: ACCTG - BAL AR INV 1152 and ACCTG - BAL AR INV 1122.
            </p>
          </div>
          <Link href="/data-explorer?table=tblfNYrQKvtOwslbr" className="btn-secondary text-xs py-1.5">
            Open Transactions Mirror
          </Link>
        </div>

        {mirrorError && (
          <div className="mt-3 text-xs text-brand-gold">
            Mirror totals are waiting on the Airtable mirror migration/sync: {mirrorError}
          </div>
        )}

        {mirrorSummary && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              {[
                { label: 'Synced Transactions', value: mirrorSummary.transactionRecordCount.toLocaleString(), tone: 'text-brand-cream' },
                { label: '1152 View Invoiced', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(mirrorSummary.invoicedFromViews), tone: 'text-brand-gold' },
                { label: '1122 View Paid', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(mirrorSummary.paidFromViews), tone: 'text-brand-sage' },
                { label: 'View Balance', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(mirrorSummary.balanceFromViews), tone: 'text-brand-cream' },
                { label: '1152 / 1122 Records', value: `${mirrorSummary.ar1152RecordCount.toLocaleString()} / ${mirrorSummary.paid1122RecordCount.toLocaleString()}`, tone: 'text-brand-cream' },
              ].map(item => (
                <div key={item.label} className="stat-card">
                  <span className="label">{item.label}</span>
                  <span className={`font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {mirrorSummary.viewStats.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Accounting View</th>
                      <th className="text-right">Records</th>
                      <th className="text-right">Debit Total</th>
                      <th className="text-right">Credit Total</th>
                      <th>Last Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mirrorSummary.viewStats.map(view => (
                      <tr key={view.viewName}>
                        <td className="text-brand-cream">{view.viewName}</td>
                        <td className="text-right font-mono">{view.recordCount.toLocaleString()}</td>
                        <td className="text-right font-mono">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(view.debitTotal)}</td>
                        <td className="text-right font-mono">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(view.creditTotal)}</td>
                        <td className="text-brand-warm/50">{view.lastSyncedAt ? new Date(view.lastSyncedAt).toLocaleString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filters */}
      <div className="card p-3 flex items-center gap-4 flex-wrap">
        <Filter size={13} className="text-brand-sage/60" />
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2">
            <label className="label">Customer Code</label>
            <input
              name="customer"
              defaultValue={sp.customer || ''}
              placeholder="BILPRO, AUBDAL..."
              className="input w-44 h-7 text-xs py-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="label">As of Date</label>
            <input
              type="date"
              name="date"
              defaultValue={sp.date || new Date().toISOString().split('T')[0]}
              className="input w-36 h-7 text-xs py-1"
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" name="showPaid" value="true" defaultChecked={includeZeroBalance} className="accent-brand-sage" />
            <span className="text-xs text-brand-warm/70">Include paid</span>
          </label>
          <button type="submit" className="btn-primary h-7 px-3 text-xs">Apply</button>
        </form>
      </div>

      {error && (
        <div className="card p-4 flex items-start gap-2 border-brand-red/30">
          <AlertCircle size={16} className="text-brand-brightred mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-brand-brightred">Error building AR report</div>
            <div className="text-xs text-brand-warm/60 mt-1">{error}</div>
            <div className="text-xs text-brand-sage/50 mt-2">
              Run initial Airtable sync in <Link href="/sync" className="text-brand-sage underline">Sync Center</Link> to populate data.
            </div>
          </div>
        </div>
      )}

      {report && (
        <>
          {/* Grand totals banner */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Invoiced',  value: report.grandTotals.totalInvoiced  },
              { label: 'Unloading Fees',  value: report.grandTotals.unloadingFee   },
              { label: 'Amount Paid',     value: report.grandTotals.amountPaid     },
              { label: 'Balance Due',     value: report.grandTotals.balanceDue, highlight: true },
            ].map(s => (
              <div key={s.label} className={`stat-card ${s.highlight && s.value > 0 ? 'border-brand-gold/50' : ''}`}>
                <span className="label">{s.label}</span>
                <span className={`text-base font-semibold font-mono ${s.highlight && s.value > 0 ? 'text-brand-gold' : 'text-brand-sage'}`}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(s.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Customer sections */}
          <div className="space-y-5">
            {report.customers.length === 0 && (
              <div className="card p-8 text-center text-brand-sage/40">
                No AR data found. Run Airtable sync to import transactions.
              </div>
            )}
            {report.customers.map(cust => (
              <div key={cust.customerCode} className="card overflow-hidden">
                {/* Customer header */}
                <div className="px-4 py-2 bg-brand-forest flex items-center justify-between border-b border-brand-green/30">
                  <div className="flex items-center gap-3">
                    <code className="text-brand-sage font-mono text-sm font-bold">{cust.customerCode}</code>
                    <span className="text-brand-cream text-sm">{cust.customerName}</span>
                    <span className="badge-gray">{cust.rowCount} loads</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-brand-warm/60">Invoiced: <span className="text-brand-warm">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.totalInvoiced)}</span></span>
                    <span className="text-brand-warm/60">Paid: <span className="text-brand-sage">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.amountPaid)}</span></span>
                    <span className={`font-semibold ${cust.balanceDue > 0 ? 'text-brand-gold' : 'text-brand-sage'}`}>
                      Bal: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.balanceDue)}
                    </span>
                  </div>
                </div>

                {/* Transactions table */}
                <div className="overflow-x-auto">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>CUST ID</th>
                        <th>DIV.</th>
                        <th>Lot #</th>
                        <th>R #</th>
                        <th>MISC.</th>
                        <th>PO #</th>
                        <th>INV Date</th>
                        <th>Dep #</th>
                        <th>Dep Date</th>
                        <th>1st CK#</th>
                        <th>2nd CK#</th>
                        <th className="text-right">Invoiced</th>
                        <th className="text-right">Credits</th>
                        <th className="text-right">Total Inv</th>
                        <th className="text-right">Unload</th>
                        <th className="text-right">Adj</th>
                        <th className="text-right">Paid</th>
                        <th className="text-right font-bold">Balance</th>
                        <th>Memo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cust.rows.map((row, i) => (
                        <tr key={i} className="table-row-hover">
                          <td className="text-brand-sage/70 font-mono">{row.customerCode}</td>
                          <td>{row.division || ''}</td>
                          <td className="font-mono">{row.lotNo || ''}</td>
                          <td className="font-mono">{row.rNo || ''}</td>
                          <td className="text-brand-warm/60">{row.miscPas || ''}</td>
                          <td className="text-brand-warm/60">{row.poNo || ''}</td>
                          <td>{fmtDate(row.invDate)}</td>
                          <td className="text-brand-warm/70">{row.depNo || ''}</td>
                          <td>{fmtDate(row.depDate)}</td>
                          <td className="font-mono text-brand-warm/70">{row.check1 || ''}</td>
                          <td className="font-mono text-brand-warm/70">{row.check2 || ''}</td>
                          <td className="text-right">{fmt(row.invoiced)}</td>
                          <td className="text-right">{row.invoiceCredits !== 0 ? fmt(row.invoiceCredits) : <span className="text-brand-warm/20">—</span>}</td>
                          <td className="text-right font-medium">{fmt(row.totalInvoiced)}</td>
                          <td className="text-right">{row.unloadingFee !== 0 ? fmt(row.unloadingFee) : <span className="text-brand-warm/20">—</span>}</td>
                          <td className="text-right">{row.adjustments !== 0 ? fmt(row.adjustments) : <span className="text-brand-warm/20">—</span>}</td>
                          <td className="text-right">{fmt(row.amountPaid)}</td>
                          <td className={`text-right font-semibold ${row.balanceDue > 0 ? 'text-brand-gold' : row.balanceDue < 0 ? 'text-brand-brightred' : 'money-zero'}`}>
                            {fmt(row.balanceDue)}
                          </td>
                          <td className="text-brand-warm/50 text-xs max-w-xs truncate">{row.memo || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Customer total row */}
                    <tfoot>
                      <tr className="bg-brand-dark/40">
                        <td colSpan={6} className="text-brand-warm/70 font-medium">{cust.customerName}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td className="text-right font-bold text-brand-cream text-xs" colSpan={1}>TOTAL:</td>
                        <td></td>
                        <td className="text-right font-bold text-brand-warm">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.invoiced)}</td>
                        <td className="text-right font-bold">{cust.invoiceCredits !== 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.invoiceCredits) : ''}</td>
                        <td className="text-right font-bold text-brand-warm">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.totalInvoiced)}</td>
                        <td className="text-right">{cust.unloadingFee !== 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.unloadingFee) : ''}</td>
                        <td className="text-right">{cust.adjustments !== 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.adjustments) : ''}</td>
                        <td className="text-right font-bold text-brand-sage">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.amountPaid)}</td>
                        <td className={`text-right font-bold ${cust.balanceDue > 0 ? 'text-brand-gold' : 'text-brand-sage'}`}>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.balanceDue)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Grand total section */}
          {report.customers.length > 0 && (
            <div className="card border-brand-gold/30 overflow-hidden">
              <div className="px-4 py-3 bg-brand-dark flex items-center justify-between">
                <span className="font-display text-lg font-semibold text-brand-gold">GRAND TOTALS</span>
                <span className="text-xs text-brand-sage/50">{report.customers.length} customers</span>
              </div>
              <div className="grid grid-cols-7 gap-0">
                {[
                  { label: 'Invoiced',       value: report.grandTotals.invoiced },
                  { label: 'Credits',        value: report.grandTotals.invoiceCredits },
                  { label: 'Total Invoiced', value: report.grandTotals.totalInvoiced },
                  { label: 'Unloading Fee',  value: report.grandTotals.unloadingFee },
                  { label: 'Adjustments',    value: report.grandTotals.adjustments },
                  { label: 'Amount Paid',    value: report.grandTotals.amountPaid },
                  { label: 'Balance Due',    value: report.grandTotals.balanceDue, highlight: true },
                ].map(s => (
                  <div key={s.label} className={`p-4 border-r border-brand-green/20 last:border-r-0 ${s.highlight ? 'bg-brand-gold/5' : ''}`}>
                    <div className="label text-[10px]">{s.label}</div>
                    <div className={`text-sm font-bold font-mono mt-1 ${s.highlight ? 'text-brand-gold' : 'text-brand-cream'}`}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(s.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
