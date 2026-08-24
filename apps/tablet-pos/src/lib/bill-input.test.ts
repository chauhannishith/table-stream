import { describe, expect, it } from 'vitest'
import { buildBillInput } from './bill-input'

describe('buildBillInput', () => {
  it('omits discount and tip when empty', () => {
    expect(
      buildBillInput({ discountType: '', discountValue: '10', tipCents: '' }),
    ).toEqual({})
  })

  it('requires whole cents for FIXED discounts', () => {
    expect(() =>
      buildBillInput({
        discountType: 'FIXED',
        discountValue: '10.5',
        tipCents: '',
      }),
    ).toThrow(/whole number of cents/)
  })

  it('allows percent decimals and optional tip', () => {
    expect(
      buildBillInput({
        discountType: 'PERCENT',
        discountValue: '10.5',
        tipCents: '100',
      }),
    ).toEqual({
      discount_type: 'PERCENT',
      discount_value: 10.5,
      tip_cents: 100,
    })
  })
})
