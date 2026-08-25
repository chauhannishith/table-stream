import type { BillInput } from './orders-api'

export type DiscountTypeChoice = '' | 'PERCENT' | 'FIXED'

/** Parse counter bill form fields into a hub BillInput. */
export function buildBillInput(fields: {
  discountType: DiscountTypeChoice
  discountValue: string
  tipCents: string
}): BillInput {
  const input: BillInput = {}
  if (fields.discountType) {
    const value = Number(fields.discountValue)
    if (fields.discountType === 'FIXED') {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('Fixed discount must be a whole number of cents')
      }
    } else if (!Number.isFinite(value) || value < 0) {
      throw new Error('Discount value must be zero or greater')
    }
    input.discount_type = fields.discountType
    input.discount_value = value
  }
  if (fields.tipCents !== '') {
    const tip = Number(fields.tipCents)
    if (!Number.isInteger(tip) || tip < 0) {
      throw new Error('Tip must be a whole number of cents')
    }
    input.tip_cents = tip
  }
  return input
}
