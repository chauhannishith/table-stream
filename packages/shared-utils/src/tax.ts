import type { PriceTaxMode } from '@table-stream/shared-types'

export type TaxComponentRates = Record<string, number>

export type LineTaxBreakdown = {
  preTaxCents: number
  taxCents: number
  lineTotalCents: number
  components: Record<string, number>
}

/** Combined rate as decimal, e.g. { cgst: 2.5, sgst: 2.5 } → 0.05 */
export function combinedTaxRate(components: TaxComponentRates): number {
  const totalPercent = Object.values(components).reduce((a, b) => a + b, 0)
  return totalPercent / 100
}

/**
 * Split entered menu price into pre-tax, tax, and total per price_tax_mode.
 * All amounts in integer cents.
 */
export function splitLineTax(
  enteredPriceCents: number,
  quantity: number,
  mode: PriceTaxMode,
  taxComponents: TaxComponentRates,
): LineTaxBreakdown {
  const rate = combinedTaxRate(taxComponents)
  const lineEntered = enteredPriceCents * quantity

  let preTaxCents: number
  let taxCents: number
  let lineTotalCents: number

  if (mode === 'EXCLUSIVE') {
    preTaxCents = lineEntered
    taxCents = Math.round(preTaxCents * rate)
    lineTotalCents = preTaxCents + taxCents
  } else {
    lineTotalCents = lineEntered
    preTaxCents = Math.round(lineTotalCents / (1 + rate))
    taxCents = lineTotalCents - preTaxCents
  }

  const components: Record<string, number> = {}
  const totalPercent = Object.values(taxComponents).reduce((a, b) => a + b, 0)
  for (const [key, pct] of Object.entries(taxComponents)) {
    components[key] =
      totalPercent === 0 ? 0 : Math.round(taxCents * (pct / totalPercent))
  }

  return { preTaxCents, taxCents, lineTotalCents, components }
}

export function perUnitFromLine(line: LineTaxBreakdown, quantity: number) {
  const q = Math.max(quantity, 1)
  return {
    unitPreTaxCents: Math.round(line.preTaxCents / q),
    unitTaxCents: Math.round(line.taxCents / q),
    unitTotalCents: Math.round(line.lineTotalCents / q),
  }
}
