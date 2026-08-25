import { centsToPriceString } from '../../lib/menu-api'

export type MoneyTotalsProps = {
  subtotalCents: number
  discountCents: number
  taxCents: number
  tipCents: number
  totalCents: number
  taxBreakdown?: Record<string, number>
}

/** Shared subtotal / tax / tip / total rows for bill, preview, and invoice. */
export function MoneyTotals({
  subtotalCents,
  discountCents,
  taxCents,
  tipCents,
  totalCents,
  taxBreakdown,
}: MoneyTotalsProps) {
  return (
    <>
      <p className="muted">
        Subtotal: {centsToPriceString(subtotalCents)}
      </p>
      <p className="muted">
        Discount: {centsToPriceString(discountCents)}
      </p>
      {taxBreakdown
        ? Object.entries(taxBreakdown).map(([name, cents]) => (
            <p key={name} className="muted">
              {name.toUpperCase()}: {centsToPriceString(cents)}
            </p>
          ))
        : null}
      <p className="muted">Tax: {centsToPriceString(taxCents)}</p>
      <p className="muted">Tip: {centsToPriceString(tipCents)}</p>
      <p>
        Total: <strong>{centsToPriceString(totalCents)}</strong>
      </p>
    </>
  )
}
