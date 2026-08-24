import { MoneyTotals } from '../../components/money/MoneyTotals'
import type { Invoice, Order } from '../../lib/orders-api'

type OrderInvoiceCardProps = {
  order: Order
  invoice: Invoice | null
  issuingInvoice: boolean
  reprintingInvoice: boolean
  onIssue: () => void
  onReprint: () => void
}

/** Issue / reprint invoice snapshot — reusable for dine-in (F3). */
export function OrderInvoiceCard({
  order,
  invoice,
  issuingInvoice,
  reprintingInvoice,
  onIssue,
  onReprint,
}: OrderInvoiceCardProps) {
  if (order.status !== 'PAID') {
    return null
  }

  return (
    <section className="card">
      <h2>Invoice</h2>
      {invoice ? (
        <>
          <p>
            <strong>{invoice.invoice_number}</strong>
          </p>
          {invoice.token_number ? (
            <p className="muted">Token: {invoice.token_number}</p>
          ) : null}
          <p>
            {invoice.business_snapshot.legal_name ||
              invoice.business_snapshot.trade_name ||
              'Business'}
          </p>
          {invoice.business_snapshot.gst_number ? (
            <p className="muted">GST: {invoice.business_snapshot.gst_number}</p>
          ) : null}
          {invoice.business_snapshot.phone ? (
            <p className="muted">{invoice.business_snapshot.phone}</p>
          ) : null}
          {invoice.business_snapshot.email ? (
            <p className="muted">{invoice.business_snapshot.email}</p>
          ) : null}
          <MoneyTotals
            subtotalCents={invoice.subtotal_cents}
            discountCents={invoice.discount_cents}
            taxCents={invoice.tax_cents}
            tipCents={invoice.tip_cents}
            totalCents={invoice.total_cents}
            taxBreakdown={invoice.tax_breakdown}
          />
          <div className="button-row">
            <button
              type="button"
              disabled={reprintingInvoice}
              onClick={onReprint}
            >
              {reprintingInvoice ? 'Loading…' : 'Reprint'}
            </button>
          </div>
        </>
      ) : (
        <div className="button-row">
          <button
            type="button"
            disabled={issuingInvoice}
            onClick={onIssue}
          >
            {issuingInvoice ? 'Issuing…' : 'Issue invoice'}
          </button>
        </div>
      )}
    </section>
  )
}
