import { MoneyTotals } from '../../components/money/MoneyTotals'
import type { DiscountTypeChoice } from '../../lib/bill-input'
import type { BillPreview, Order } from '../../lib/orders-api'

type OrderBillCardProps = {
  order: Order
  billLocked: boolean
  discountType: DiscountTypeChoice
  discountValue: string
  tipCents: string
  billPreview: BillPreview | null
  previewingBill: boolean
  lockingBill: boolean
  onDiscountTypeChange: (value: DiscountTypeChoice) => void
  onDiscountValueChange: (value: string) => void
  onTipChange: (value: string) => void
  onPreview: () => void
  onLock: () => void
}

/** Bill preview and lock — reusable for dine-in checkout (F3). */
export function OrderBillCard({
  order,
  billLocked,
  discountType,
  discountValue,
  tipCents,
  billPreview,
  previewingBill,
  lockingBill,
  onDiscountTypeChange,
  onDiscountValueChange,
  onTipChange,
  onPreview,
  onLock,
}: OrderBillCardProps) {
  if (order.lines.length === 0) {
    return null
  }

  return (
    <section className="card">
      <h2>Bill</h2>
      {billLocked ? (
        <>
          <p className="muted">Status: {order.status}</p>
          <MoneyTotals
            subtotalCents={order.subtotal_cents}
            discountCents={order.discount_cents}
            taxCents={order.tax_cents}
            tipCents={order.tip_cents}
            totalCents={order.total_cents}
          />
        </>
      ) : (
        <>
          <label className="field">
            <span>Discount type</span>
            <select
              aria-label="Discount type"
              value={discountType}
              onChange={(event) =>
                onDiscountTypeChange(event.target.value as DiscountTypeChoice)
              }
            >
              <option value="">None</option>
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed (cents)</option>
            </select>
          </label>
          {discountType ? (
            <label className="field">
              <span>
                {discountType === 'PERCENT' ? 'Discount %' : 'Discount cents'}
              </span>
              <input
                aria-label="Discount value"
                inputMode={discountType === 'FIXED' ? 'numeric' : 'decimal'}
                value={discountValue}
                onChange={(event) => {
                  const next =
                    discountType === 'FIXED'
                      ? event.target.value.replace(/\D/g, '')
                      : event.target.value.replace(/[^\d.]/g, '')
                  onDiscountValueChange(next)
                }}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Tip (cents)</span>
            <input
              aria-label="Tip in cents"
              inputMode="numeric"
              value={tipCents}
              onChange={(event) =>
                onTipChange(event.target.value.replace(/\D/g, ''))
              }
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              disabled={previewingBill || lockingBill}
              onClick={onPreview}
            >
              {previewingBill ? 'Previewing…' : 'Preview bill'}
            </button>
            <button
              type="button"
              disabled={lockingBill || previewingBill}
              onClick={onLock}
            >
              {lockingBill ? 'Locking…' : 'Lock bill'}
            </button>
          </div>
          {billPreview ? (
            <MoneyTotals
              subtotalCents={billPreview.subtotal_cents}
              discountCents={billPreview.discount_cents}
              taxCents={billPreview.tax_cents}
              tipCents={billPreview.tip_cents}
              totalCents={billPreview.total_cents}
              taxBreakdown={billPreview.tax_breakdown}
            />
          ) : null}
        </>
      )}
    </section>
  )
}
