import { describe, expect, it } from 'vitest'
import { combinedTaxRate, splitLineTax } from './tax.js'

describe('splitLineTax', () => {
  const gst = { cgst: 2.5, sgst: 2.5 }

  it('splits exclusive prices by adding tax on top', () => {
    const line = splitLineTax(10000, 2, 'EXCLUSIVE', gst)
    expect(line.preTaxCents).toBe(20000)
    expect(line.taxCents).toBe(1000)
    expect(line.lineTotalCents).toBe(21000)
  })

  it('splits inclusive prices by backing out tax', () => {
    const line = splitLineTax(10500, 1, 'INCLUSIVE', gst)
    expect(line.lineTotalCents).toBe(10500)
    expect(line.preTaxCents).toBe(10000)
    expect(line.taxCents).toBe(500)
  })
})

describe('combinedTaxRate', () => {
  it('sums component percentages into a decimal rate', () => {
    expect(combinedTaxRate({ cgst: 2.5, sgst: 2.5 })).toBeCloseTo(0.05)
  })
})
