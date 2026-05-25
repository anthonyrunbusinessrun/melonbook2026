'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Zap, FileText, Plus, CheckCircle, AlertCircle, Copy, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const ACCOUNTS = [
  { code: 'LWS-1152', no: '1152', name: 'Accounts Receivable', type: 'Asset', df: 'Dr' },
  { code: 'LWS-1122', no: '1122', name: 'Undeposited Funds', type: 'Asset', df: 'Dr' },
  { code: 'LWS-1310', no: '1310', name: 'Accounts Payable', type: 'Liability', df: 'Cr' },
  { code: 'LWS-1610', no: '1610', name: 'Sales - Watermelons', type: 'Revenue', df: 'Cr' },
  { code: 'LWS-1710', no: '1710', name: 'Freight Cost Watermelons', type: 'COGS', df: 'Dr' },
];

const TEMPLATES = [
  {
    id: 'ar_invoice',
    name: 'AR Invoice',
    icon: '📄',
    desc: 'Customer invoice — debits A/R 1152, credits Sales 1610',
    color: 'border-brand-gold/40',
    fields: [
      { key: 'folio', label: 'Folio / Lot #', type: 'text', placeholder: 'e.g. LOT-123' },
      { key: 'customer', label: 'Customer Code', type: 'text', placeholder: 'e.g. FOOLIO' },
      { key: 'ref1', label: 'Invoice Ref', type: 'text', placeholder: 'e.g. R-IN-1234' },
      { key: 'amount', label: 'Invoice Amount ($)', type: 'number', placeholder: '0.00' },
      { key: 'date', label: 'Invoice Date', type: 'date' },
      { key: 'memo', label: 'Memo', type: 'text', placeholder: 'Optional notes' },
    ],
    entries: (vals: Record<string,string>) => [
      { account: 'LWS-1152', df: 'Dr', debit: vals.amount, credit: '', desc: `DR A/R - ${vals.customer} - ${vals.ref1}` },
      { account: 'LWS-1610', df: 'Cr', debit: '', credit: vals.amount, desc: `CR Sales - ${vals.customer} - ${vals.folio}` },
    ],
  },
  {
    id: 'payment_received',
    name: 'Payment Received',
    icon: '💰',
    desc: 'Customer payment — debits Undeposited 1122, credits A/R 1152',
    color: 'border-brand-sage/40',
    fields: [
      { key: 'customer', label: 'Customer Code', type: 'text', placeholder: 'e.g. FOOLIO' },
      { key: 'checkNo', label: 'Check / Payment #', type: 'text', placeholder: 'e.g. CK-5001' },
      { key: 'ref1', label: 'Original Invoice Ref', type: 'text', placeholder: 'e.g. R-IN-1234' },
      { key: 'amount', label: 'Payment Amount ($)', type: 'number', placeholder: '0.00' },
      { key: 'date', label: 'Payment Date', type: 'date' },
    ],
    entries: (vals: Record<string,string>) => [
      { account: 'LWS-1122', df: 'Dr', debit: vals.amount, credit: '', desc: `DR Undeposited - ${vals.customer} - ${vals.checkNo}` },
      { account: 'LWS-1152', df: 'Cr', debit: '', credit: vals.amount, desc: `CR A/R - ${vals.customer} - ${vals.ref1}` },
    ],
  },
  {
    id: 'freight_cost',
    name: 'Freight Cost',
    icon: '🚛',
    desc: 'Freight expense — debits Freight 1710, credits A/P 1310',
    color: 'border-blue-500/30',
    fields: [
      { key: 'folio', label: 'Folio / Lot #', type: 'text', placeholder: 'e.g. LOT-123' },
      { key: 'vendor', label: 'Carrier / Vendor Code', type: 'text', placeholder: 'e.g. EARINC' },
      { key: 'ref1', label: 'Bill of Lading / Ref', type: 'text', placeholder: 'e.g. BOL-789' },
      { key: 'amount', label: 'Freight Amount ($)', type: 'number', placeholder: '0.00' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
    entries: (vals: Record<string,string>) => [
      { account: 'LWS-1710', df: 'Dr', debit: vals.amount, credit: '', desc: `DR Freight - ${vals.vendor} - ${vals.folio}` },
      { account: 'LWS-1310', df: 'Cr', debit: '', credit: vals.amount, desc: `CR A/P - ${vals.vendor} - ${vals.ref1}` },
    ],
  },
];

type Entry = { account: string; df: string; debit: string; credit: string; desc: string };

function EntryPreview({ entries }: { entries: Entry[] }) {
  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-brand-green/20">
      <div className="bg-brand-dark/40 px-3 py-2 text-xs font-semibold text-brand-sage/60">Journal Entry Preview</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-brand-green/10">
            {['Account','D/C','Debit','Credit','Description'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-brand-sage/50 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-brand-green/10">
              <td className="px-3 py-2 font-mono text-brand-gold">{e.account}</td>
              <td className="px-3 py-2"><span className={`badge text-[10px] ${e.df === 'Dr' ? 'badge-gold' : 'badge-green'}`}>{e.df}</span></td>
              <td className="px-3 py-2 font-mono text-brand-gold/80">{e.debit ? `$${parseFloat(e.debit).toFixed(2)}` : '—'}</td>
              <td className="px-3 py-2 font-mono text-brand-sage/80">{e.credit ? `$${parseFloat(e.credit).toFixed(2)}` : '—'}</td>
              <td className="px-3 py-2 text-brand-cream/60 max-w-[200px] truncate">{e.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EncoderPage() {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [formVals, setFormVals] = useState<Record<string, Record<string,string>>>({});
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [copiedAirtable, setCopiedAirtable] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const tpl = TEMPLATES.find(t => t.id === activeTemplate);
  const vals = activeTemplate ? (formVals[activeTemplate] || {}) : {};
  const entries = tpl && vals.amount ? tpl.entries(vals) : [];
  const isBalanced = entries.length === 0 ||
    Math.abs(entries.reduce((s, e) => s + parseFloat(e.debit || '0') - parseFloat(e.credit || '0'), 0)) < 0.01;

  function setVal(key: string, value: string) {
    if (!activeTemplate) return;
    setFormVals(prev => ({ ...prev, [activeTemplate]: { ...(prev[activeTemplate] || {}), [key]: value } }));
  }

  async function handleSubmit() {
    if (!activeTemplate || !tpl) return;
    setSaveError('');

    if (!vals.customer && activeTemplate !== 'freight_cost') {
      setSaveError('Customer code is required before saving an AR draft.');
      return;
    }

    if (activeTemplate === 'freight_cost') {
      setSubmitted(prev => [
        ...prev,
        `${tpl.name} preview prepared — ${vals.amount ? '$' + parseFloat(vals.amount).toFixed(2) : ''} — ${new Date().toLocaleTimeString()}`,
      ]);
      setFormVals(prev => ({ ...prev, [activeTemplate]: {} }));
      return;
    }

    const payload = activeTemplate === 'ar_invoice'
      ? {
          entryStatus: 'draft',
          customerCode: vals.customer,
          lotNo: vals.folio,
          rNo: vals.ref1,
          invDate: vals.date,
          invoiced: vals.amount,
          memo: vals.memo || `Encoder Station invoice ${vals.ref1 || ''}`.trim(),
        }
      : {
          entryStatus: 'draft',
          customerCode: vals.customer,
          rNo: vals.ref1,
          depDate: vals.date,
          check1: vals.checkNo,
          amountPaid: vals.amount,
          memo: `Encoder Station payment ${vals.checkNo || vals.ref1 || ''}`.trim(),
        };

    setSaving(true);
    try {
      const response = await fetch('/api/ar/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save AR draft.');

      setSubmitted(prev => [
        ...prev,
        `${tpl.name} draft saved — ${vals.customer} — ${vals.amount ? '$' + parseFloat(vals.amount).toFixed(2) : ''} — ${new Date().toLocaleTimeString()}`,
      ]);
      setFormVals(prev => ({ ...prev, [activeTemplate]: {} }));
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function copyAirtableUrl() {
    if (!tpl) return;
    const url = `https://airtable.com/appmnU55C5f7A50U4/tblfNYrQKvtOwslbr/viwXXXXXX`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedAirtable(true);
      setTimeout(() => setCopiedAirtable(false), 2000);
    });
  }

  function parseBatch() {
    // Parse CSV-like batch input
    const lines = batchText.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map((line, i) => {
      const [folio, customer, ref, amount, date] = line.split(',').map(s => s.trim());
      return `${i + 1}. LOT: ${folio} | Customer: ${customer} | Ref: ${ref} | Amount: $${parseFloat(amount || '0').toFixed(2)} | Date: ${date}`;
    });
    setBatchResult(parsed.join('\n'));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream flex items-center gap-2">
            <Zap size={24} className="text-brand-gold" /> Encoder Station
          </h1>
          <p className="text-brand-sage/60 text-sm">
            Fast data entry tools for accounting staff · Templates, batch upload, and quick-entry forms
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/ar-input" className="btn-gold text-xs py-1.5 flex items-center gap-1">
            <Plus size={12} /> AR Input
          </Link>
          <button
            onClick={() => setBatchMode(!batchMode)}
            className="btn-secondary text-xs py-1.5 flex items-center gap-1"
          >
            <FileText size={12} /> {batchMode ? 'Single Entry' : 'Batch Mode'}
          </button>
        </div>
      </div>

      {/* Submitted queue */}
      {submitted.length > 0 && (
        <div className="card p-4">
          <p className="text-xs text-brand-sage font-semibold mb-2 flex items-center gap-1">
            <CheckCircle size={12} /> Recently Submitted ({submitted.length})
          </p>
          <div className="space-y-1">
            {submitted.map((s, i) => (
              <p key={i} className="text-xs text-brand-cream/60">✓ {s}</p>
            ))}
          </div>
        </div>
      )}

      {/* Template picker */}
      <div>
        <p className="text-xs text-brand-sage/60 uppercase tracking-widest mb-3">Select Entry Type</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTemplate(activeTemplate === t.id ? null : t.id)}
              className={`card p-4 text-left transition-all ${t.color} ${activeTemplate === t.id ? 'border-2 shadow-lg' : 'hover:border-brand-green/40'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{t.icon}</span>
                <span className="font-semibold text-brand-cream text-sm">{t.name}</span>
                {activeTemplate === t.id ? <ChevronUp size={14} className="ml-auto text-brand-sage" /> : <ChevronDown size={14} className="ml-auto text-brand-sage/40" />}
              </div>
              <p className="text-xs text-brand-sage/60">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Active form */}
      {tpl && !batchMode && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-brand-cream flex items-center gap-2">
              <span className="text-xl">{tpl.icon}</span> {tpl.name}
            </h2>
            <button onClick={copyAirtableUrl} className="text-xs text-brand-sage/60 hover:text-brand-cream flex items-center gap-1">
              <Copy size={11} /> {copiedAirtable ? 'Copied!' : 'Airtable URL'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tpl.fields.map(field => (
              <div key={field.key}>
                <label className="label mb-1 block">{field.label}</label>
                <input
                  type={field.type}
                  value={vals[field.key] || ''}
                  onChange={e => setVal(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="input text-sm"
                />
              </div>
            ))}
          </div>

          {entries.length > 0 && <EntryPreview entries={entries} />}

          {entries.length > 0 && !isBalanced && (
            <div className="flex items-center gap-2 text-brand-brightred text-xs">
              <AlertCircle size={12} /> Entries do not balance — check debit and credit amounts
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 rounded border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-brand-brightred text-xs">
              <AlertCircle size={12} /> {saveError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !vals.amount || !isBalanced}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {activeTemplate === 'freight_cost' ? 'Prepare Preview' : 'Save AR Draft'}
            </button>
            <button
              onClick={() => setFormVals(prev => ({ ...prev, [tpl.id]: {} }))}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <RefreshCw size={12} /> Reset
            </button>
          </div>
        </div>
      )}

      {/* Batch mode */}
      {batchMode && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-brand-cream">Batch Entry — CSV Format</h2>
          <p className="text-xs text-brand-sage/60">
            Paste rows in format: <code className="bg-brand-dark/60 px-1 rounded">Folio, CustomerCode, Reference, Amount, Date</code>
          </p>
          <p className="text-xs text-brand-sage/40">
            Example: LOT-123, FOOLIO, R-IN-4001, 15600.00, 2026-05-20
          </p>
          <textarea
            value={batchText}
            onChange={e => setBatchText(e.target.value)}
            rows={8}
            placeholder="LOT-123, FOOLIO, R-IN-4001, 15600.00, 2026-05-20&#10;LOT-124, ROCPRO, R-IN-4002, 18800.00, 2026-05-20&#10;LOT-125, RICFAR, R-IN-4003, 12320.00, 2026-05-21"
            className="input font-mono text-xs"
          />
          <div className="flex gap-2">
            <button onClick={parseBatch} className="btn-primary flex items-center gap-2">
              <Zap size={14} /> Parse & Preview
            </button>
            <button onClick={() => { setBatchText(''); setBatchResult(null); }} className="btn-secondary text-sm">Clear</button>
          </div>
          {batchResult && (
            <div className="bg-brand-dark/40 rounded p-4">
              <p className="text-xs text-brand-sage font-semibold mb-2">Parsed {batchResult.split('\n').length} entries:</p>
              <pre className="text-xs text-brand-cream/70 overflow-auto max-h-48">{batchResult}</pre>
              <button
                className="btn-gold mt-3 flex items-center gap-2 text-sm"
                onClick={() => alert(`${batchResult.split('\n').length} entries parsed. Use AR Input for saved drafts, or paste these reviewed rows into Airtable when ready.`)}
              >
                <CheckCircle size={14} /> Mark Batch Reviewed
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick reference */}
      <div className="card p-4">
        <h3 className="font-semibold text-brand-cream text-sm mb-3">Account Quick Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ACCOUNTS.map(a => (
            <div key={a.code} className="flex items-center gap-3 py-1.5 border-b border-brand-green/10 last:border-0">
              <span className="font-mono text-brand-gold text-xs font-bold w-20">{a.code}</span>
              <span className="text-brand-cream/80 text-xs flex-1">{a.name}</span>
              <span className={`badge text-[10px] ${a.df === 'Dr' ? 'badge-gold' : 'badge-green'}`}>{a.df}</span>
              <span className="text-brand-sage/40 text-[10px]">{a.type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 text-center border-brand-gold/20">
        <p className="text-sm text-brand-cream mb-2">Need a faster path for repetitive accounting entry?</p>
        <p className="text-xs text-brand-sage/60 mb-3">
          AR invoice and payment templates save draft AR rows to PostgreSQL. Use the full AR Input page for spreadsheet-style detail entry and review.
        </p>
        <Link href="/ar-input" className="btn-secondary text-sm">Open AR Input</Link>
      </div>
    </div>
  );
}
