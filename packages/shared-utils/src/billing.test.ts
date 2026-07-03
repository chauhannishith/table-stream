import { describe, expect, it } from 'vitest'
import { computeBillTotals } from './billing.js'

describe('computeBillTotals', () => {
  it('totals lines with exclusive tax and a percent discount', () => {
    const bill = computeBillTotals({
      lines: [{ enteredUnitPriceCents: 10000, quantity: 1 }],
      priceTaxMode: 'EXCLUSIVE',
      taxComponents: { cgst: 2.5, sgst: 2.5 },
      discountType: 'PERCENT',
      discountValue: 10,
      tipCents: 500,
    })

    expect(bill.subtotalCents).toBe(10000)
    expect(bill.discountCents).toBe(1000)
    expect(bill.discountedSubtotalCents).toBe(9000)
    expect(bill.taxCents).toBe(450)
    expect(bill.tipCents).toBe(500)
    expect(bill.totalCents).toBe(9950)
  })

  it('includes modifier extras in the line subtotal', () => {
    const bill = computeBillTotals({
      lines: [
        {
          enteredUnitPriceCents: 50000,
          quantity: 1,
          modifierExtraCents: 150,
        },
      ],
      priceTaxMode: 'EXCLUSIVE',
      taxComponents: { cgst: 2.5, sgst: 2.5 },
    })

    expect(bill.subtotalCents).toBe(50150)
    expect(bill.taxCents).toBe(Math.round(50150 * 0.05))
  })
})
