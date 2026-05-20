export const dynamic = "force-dynamic";
import { query, queryOne } from '@/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, DollarSign, FileText } from 'lucide-react';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default async function CustomerDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  const contact = await queryOne<{
    id: string; code: string; name: string; entity_company_name: string;
    contact_type: string; is_customer: boolean; is_vendor: boolean; is_freight: boolean;
    address: string; city: string; state: string; zip: string;
    phone1: string; phone1_title: string; email: string; notes: string;
    ar_limit: number; ar_terms: number; last_synced_at: string; airtable_record_id: string;
    total_invoiced: number; total_paid: number; balance_due: number;
  }>(`
    SELECT c.*,
      COALESCE(SUM(v.invoiced_amount), 0) as total_invoiced,
      COALESCE(SUM(v.amount_paid), 0) as total_paid,
      COALESCE(SUM(v.balance_due), 0) as balance_due
    FROM contacts c
    LEFT JOIN vouchers v ON v.issued_contact_id = c.id AND v.deleted_at IS NULL
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);

  if (!contact) notFound();

  const vouchers = await query<{
    id: string; voucher_code: string; lot_no: string; r_no: string;
    accrue_date: string; dep_no: string; status: string;
    invoiced_amount: number; balance_due: number; ck_no: string;
  }>(`
    SELECT id, voucher_code, lot_no, r_no, accrue_date, dep_no, status,
      invoiced_amount, balance_due, ck_no
    FROM vouchers
    WHERE issued_contact_id = $1 AND deleted_at IS NULL
    ORDER BY accrue_date DESC NULLS LAST
    LIMIT 50
  `, [id]);

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <Link href="/customers" className="flex items-center gap-1.5 text-brand-sage/60 hover:text-brand-sage text-sm transition-colors">
        <ArrowLeft size={13} />
        Back to Customers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <code className="text-brand-sage font-mono text-lg font-bold">{contact.code}</code>
            <div className="flex gap-1">
              {contact.is_customer && <span className="badge-green">Customer</span>}
              {contact.is_vendor && <span className="badge-gold">Vendor</span>}
              {contact.is_freight && <span className="badge-gray">Freight</span>}
            </div>
          </div>
          <h1 className="font-display text-2xl font-semibold text-brand-cream">
            {contact.entity_company_name || contact.name}
          </h1>
        </div>
        {contact.airtable_record_id && (
          <a
            href={`https://airtable.com/appmnU55C5f7A50U4/tblqy4XXa2ap3g66T/${contact.airtable_record_id}`}
            target="_blank"
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <ExternalLink size={12} />
            View in Airtable
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <span className="label">Total Invoiced</span>
          <span className="text-lg font-semibold text-brand-warm font-mono">{fmt(Number(contact.total_invoiced))}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total Paid</span>
          <span className="text-lg font-semibold text-brand-sage font-mono">{fmt(Number(contact.total_paid))}</span>
        </div>
        <div className={`stat-card ${Number(contact.balance_due) > 0 ? 'border-brand-gold/40' : ''}`}>
          <span className="label">Balance Due</span>
          <span className={`text-lg font-semibold font-mono ${Number(contact.balance_due) > 0 ? 'text-brand-gold' : 'text-brand-sage'}`}>
            {fmt(Number(contact.balance_due))}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Contact info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-brand-cream mb-3">Contact Information</h3>
          <dl className="space-y-2 text-xs">
            {[
              { label: 'Address', value: [contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(', ') },
              { label: 'Phone', value: contact.phone1 },
              { label: 'Email', value: contact.email },
              { label: 'AR Limit', value: contact.ar_limit ? fmt(contact.ar_limit) : '—' },
              { label: 'AR Terms', value: contact.ar_terms ? `Net ${contact.ar_terms}` : '—' },
              { label: 'Last Synced', value: contact.last_synced_at ? new Date(contact.last_synced_at).toLocaleString() : 'Never' },
            ].map(row => (
              <div key={row.label} className="flex gap-2">
                <dt className="text-brand-sage/60 w-24 shrink-0">{row.label}</dt>
                <dd className="text-brand-warm/80">{row.value || '—'}</dd>
              </div>
            ))}
          </dl>
          {contact.notes && (
            <div className="mt-3 pt-3 border-t border-brand-green/20">
              <div className="text-xs text-brand-sage/60 mb-1">Notes</div>
              <div className="text-xs text-brand-warm/70 whitespace-pre-wrap">{contact.notes}</div>
            </div>
          )}
        </div>

        {/* Voucher summary */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-brand-cream mb-3 flex items-center gap-2">
            <FileText size={13} className="text-brand-sage" />
            Invoice History ({vouchers.length})
          </h3>
          <div className="overflow-y-auto max-h-64">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Lot #</th>
                  <th>R #</th>
                  <th>Date</th>
                  <th className="text-right">Invoiced</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono">{v.lot_no || '—'}</td>
                    <td className="font-mono text-brand-warm/60">{v.r_no || '—'}</td>
                    <td>{v.accrue_date ? new Date(v.accrue_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'}</td>
                    <td className="text-right font-mono">{fmt(v.invoiced_amount || 0)}</td>
                    <td className={`text-right font-mono font-medium ${(v.balance_due || 0) > 0 ? 'text-brand-gold' : 'text-brand-sage'}`}>
                      {fmt(v.balance_due || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
