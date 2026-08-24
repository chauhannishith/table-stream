import { centsToPriceString } from '../../lib/menu-api'
import type { Order } from '../../lib/orders-api'

type OrderHeaderCardProps = {
  order: Order
  draftLineCount: number
  submittingOrder: boolean
  onSubmit: () => void
}

/** Takeaway header: identity, token, submit. */
export function OrderHeaderCard({
  order,
  draftLineCount,
  submittingOrder,
  onSubmit,
}: OrderHeaderCardProps) {
  return (
    <section className="card">
      <h2>{order.customer_name || 'Draft takeaway'}</h2>
      <p className="muted">Order ID: {order.id}</p>
      <p className="muted">Zone: {order.zone_id || 'Unassigned'}</p>
      {order.token_number ? (
        <p>
          Token: <strong>{order.token_number}</strong>
        </p>
      ) : null}
      <p className="muted">
        Subtotal: {centsToPriceString(order.subtotal_cents)}
      </p>
      <div className="button-row">
        <button
          type="button"
          disabled={submittingOrder || draftLineCount < 1}
          onClick={onSubmit}
        >
          {submittingOrder ? 'Submitting…' : 'Submit to kitchen'}
        </button>
      </div>
    </section>
  )
}
