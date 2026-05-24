'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, CheckCircle, FileSpreadsheet, Loader2, Plus, RefreshCw } from 'lucide-react';

type ManualEntry = {
  id: string;
  ar_year: number;
  entry_status: string;
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
  created_at: string;
};

type CustomerOption = {
  code: string;
  name: string;
};

type Summary = {
  count: string;
  total_invoiced: string;
  total_paid: string;
  balance_due: string;
};

const initialForm = {
  arYear: '2026',
  entryStatus: 'draft',
  customerCode: '',
  customerName: '',
  division: '',
  lotNo: '',
  rNo: '',
  miscPas: '',
  poNo: '',
  invDate: '',
  depNo: '',
  depDate: '',
  check1: '',
  check2: '',
  invoiced: '',
  invoiceCredits: '',
  unloadingFee: '',
  adjustments: '',
  amountPaid: '',
  memo: '',
};

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function num(value: string) {
  const parsed = Number(String(value || '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ARInputPage() {
  const [form, setForm] = useState(initialForm);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const totals = useMemo(() => {
    const totalInvoiced = num(form.invoiced) + num(form.invoiceCredits);
    const balanceDue = totalInvoiced + num(form.unloadingFee) + num(form.adjustments) - num(form.amountPaid);
    return { totalInvoiced, balanceDue };
  }, [form.invoiced, form.invoiceCredits, form.unloadingFee, form.adjustments, form.amountPaid]);

  async function loadEntries() {
    setLoading(true);
    try {
      const res = await fetch('/api/ar/manual', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load AR entries');
      setEntries(data.entries || []);
      setCustomers(data.customers || []);
      setSummary(data.summary || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function update(key: keyof typeof initialForm, value: string) {
    const next = { ...form, [key]: value };
    if (key === 'customerCode') {
      const customer = customers.find(item => item.code.toUpperCase() === value.toUpperCase());
      if (customer && !form.customerName) next.customerName = customer.name;
    }
    setForm(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/ar/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save AR entry');
      setSuccess('AR entry saved to PostgreSQL.');
      setForm(initialForm);
      await loadEntries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">AR Input</h1>
          <p className="text-brand-sage/60 text-sm">
            Spreadsheet-style Accounts Receivable entry based on the 2026 AR workbook.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadEntries} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} />
            Refresh
          </button>
          <Link href="/ar-report" className="btn-secondary flex items-center gap-1.5 text-sm">
            <FileSpreadsheet size={14} />
            AR Report
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Manual Entries', value: Number(summary?.count || 0).toLocaleString() },
          { label: 'Total Invoiced', value: money(summary?.total_invoiced) },
          { label: 'Amount Paid', value: money(summary?.total_paid) },
          { label: 'Balance Due', value: money(summary?.balance_due), highlight: true },
        ].map(item => (
          <div key={item.label} className={`stat-card ${item.highlight ? 'border-brand-gold/40' : ''}`}>
            <span className="label">{item.label}</span>
            <span className={`font-mono text-base font-semibold ${item.highlight ? 'text-brand-gold' : 'text-brand-cream'}`}>{item.value}</span>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-brand-green/20 pb-3">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-brand-sage" />
            <h2 className="text-sm font-semibold text-brand-cream">New AR Entry</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-brand-warm/60">Total Invoiced: <span className="text-brand-sage">{money(totals.totalInvoiced)}</span></span>
            <span className="text-brand-warm/60">Balance Due: <span className={totals.balanceDue > 0 ? 'text-brand-gold' : 'text-brand-sage'}>{money(totals.balanceDue)}</span></span>
          </div>
        </div>

        {error && <div className="rounded border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-brightred">{error}</div>}
        {success && (
          <div className="flex items-center gap-2 rounded border border-brand-sage/30 bg-brand-green/10 px-3 py-2 text-xs text-brand-sage">
            <CheckCircle size={13} /> {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Field label="Cust ID" required>
            <input list="customer-codes" value={form.customerCode} onChange={e => update('customerCode', e.target.value.toUpperCase())} className="input h-9" placeholder="AUBDAL" required />
            <datalist id="customer-codes">
              {customers.map(customer => <option key={customer.code} value={customer.code}>{customer.name}</option>)}
            </datalist>
          </Field>
          <Field label="Customer Name">
            <input value={form.customerName} onChange={e => update('customerName', e.target.value)} className="input h-9" placeholder="Auto-fills when known" />
          </Field>
          <Field label="Div.">
            <input value={form.division} onChange={e => update('division', e.target.value.toUpperCase())} className="input h-9" placeholder="DUN" />
          </Field>
          <Field label="Lot #">
            <input value={form.lotNo} onChange={e => update('lotNo', e.target.value)} className="input h-9" />
          </Field>
          <Field label="R #">
            <input value={form.rNo} onChange={e => update('rNo', e.target.value)} className="input h-9" />
          </Field>
          <Field label="Misc/PAS">
            <input value={form.miscPas} onChange={e => update('miscPas', e.target.value.toUpperCase())} className="input h-9" placeholder="PAS" />
          </Field>
          <Field label="PO #">
            <input value={form.poNo} onChange={e => update('poNo', e.target.value)} className="input h-9" />
          </Field>
          <Field label="Inv Date">
            <input type="date" value={form.invDate} onChange={e => update('invDate', e.target.value)} className="input h-9" />
          </Field>
          <Field label="Dep #">
            <input value={form.depNo} onChange={e => update('depNo', e.target.value.toUpperCase())} className="input h-9" placeholder="REG-18" />
          </Field>
          <Field label="Dep Date">
            <input type="date" value={form.depDate} onChange={e => update('depDate', e.target.value)} className="input h-9" />
          </Field>
          <Field label="1st Check #">
            <input value={form.check1} onChange={e => update('check1', e.target.value)} className="input h-9" />
          </Field>
          <Field label="2nd Check #">
            <input value={form.check2} onChange={e => update('check2', e.target.value)} className="input h-9" />
          </Field>
          <MoneyField label="Invoiced" value={form.invoiced} onChange={value => update('invoiced', value)} />
          <MoneyField label="Invoice Credits" value={form.invoiceCredits} onChange={value => update('invoiceCredits', value)} />
          <MoneyField label="Unloading Fee" value={form.unloadingFee} onChange={value => update('unloadingFee', value)} />
          <MoneyField label="Adjustments" value={form.adjustments} onChange={value => update('adjustments', value)} />
          <MoneyField label="Amount Paid" value={form.amountPaid} onChange={value => update('amountPaid', value)} />
          <Field label="Status">
            <select value={form.entryStatus} onChange={e => update('entryStatus', e.target.value)} className="select h-9">
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="void">Void</option>
            </select>
          </Field>
          <div className="md:col-span-4 xl:col-span-6">
            <Field label="Memo">
              <textarea value={form.memo} onChange={e => update('memo', e.target.value)} className="input min-h-20" placeholder="Fine, rejected load, payment note, special handling..." />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-green/20 pt-3">
          <button type="button" onClick={() => setForm(initialForm)} className="btn-secondary">Clear</button>
          <button type="submit" disabled={saving} className="btn-gold flex items-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Save AR Entry
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-cream">Recent Manual AR Entries</h2>
          <span className="badge-gray">{entries.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Cust ID</th>
                <th>Div.</th>
                <th>Lot #</th>
                <th>R #</th>
                <th>Misc/PAS</th>
                <th>PO #</th>
                <th>Inv Date</th>
                <th>Dep #</th>
                <th>Dep Date</th>
                <th>1st Check #</th>
                <th>2nd Check #</th>
                <th className="text-right">Invoiced</th>
                <th className="text-right">Credits</th>
                <th className="text-right">Total Inv</th>
                <th className="text-right">Unload</th>
                <th className="text-right">Adjust</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={19} className="text-center py-10 text-brand-sage/50">Loading entries...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={19} className="text-center py-10 text-brand-sage/50">No manual AR entries yet.</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id}>
                  <td className="font-mono text-brand-sage">{entry.customer_code}</td>
                  <td>{entry.division || ''}</td>
                  <td className="font-mono">{entry.lot_no || ''}</td>
                  <td className="font-mono">{entry.r_no || ''}</td>
                  <td>{entry.misc_pas || ''}</td>
                  <td>{entry.po_no || ''}</td>
                  <td>{entry.inv_date ? new Date(entry.inv_date).toLocaleDateString() : ''}</td>
                  <td>{entry.dep_no || ''}</td>
                  <td>{entry.dep_date ? new Date(entry.dep_date).toLocaleDateString() : ''}</td>
                  <td>{entry.check1 || ''}</td>
                  <td>{entry.check2 || ''}</td>
                  <td className="text-right font-mono">{money(entry.invoiced)}</td>
                  <td className="text-right font-mono">{money(entry.invoice_credits)}</td>
                  <td className="text-right font-mono">{money(entry.total_invoiced)}</td>
                  <td className="text-right font-mono">{money(entry.unloading_fee)}</td>
                  <td className="text-right font-mono">{money(entry.adjustments)}</td>
                  <td className="text-right font-mono text-brand-sage">{money(entry.amount_paid)}</td>
                  <td className={`text-right font-mono font-semibold ${Number(entry.balance_due) > 0 ? 'text-brand-gold' : 'text-brand-sage'}`}>{money(entry.balance_due)}</td>
                  <td className="max-w-xs truncate text-brand-warm/55">{entry.memo || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="label block mb-1.5">{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input h-9 text-right font-mono"
        placeholder="0.00"
      />
    </Field>
  );
}
