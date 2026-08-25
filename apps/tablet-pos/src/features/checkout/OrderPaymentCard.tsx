import { centsToPriceString } from '../../lib/menu-api'
import type { Order, TenderType } from '../../lib/orders-api'

type OrderPaymentCardProps = {
  order: Order
  tenderType: TenderType
  recordingPayment: boolean
  onTenderChange: (value: TenderType) => void
  onRecordPayment: () => void
}

/** Tender select after CHECK_PRINTED — reusable for dine-in (F3). */
export function OrderPaymentCard({
  order,
  tenderType,
  recordingPayment,
  onTenderChange,
  onRecordPayment,
}: OrderPaymentCardProps) {
  if (order.status !== 'CHECK_PRINTED' && order.status !== 'PAID') {
    return null
  }

  return (
    <section className="card">
      <h2>Payment</h2>
      {order.status === 'PAID' ? (
        <p>
          Paid <strong>{centsToPriceString(order.total_cents)}</strong>
        </p>
      ) : (
        <>
          <label className="field">
            <span>Tender</span>
            <select
              aria-label="Tender type"
              value={tenderType}
              onChange={(event) =>
                onTenderChange(event.target.value as TenderType)
              }
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <div className="button-row">
            <button
              type="button"
              disabled={recordingPayment}
              onClick={onRecordPayment}
            >
              {recordingPayment ? 'Recording…' : 'Record payment'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
