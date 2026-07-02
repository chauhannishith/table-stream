import type { DiscountType, PriceTaxMode } from '@table-stream/shared-types'
import {
  combinedTaxRate,
  splitLineTax,
  type TaxComponentRates,
} from './tax.js'

export type BillLineInput = {
  enteredUnitPriceCents: number
  quantity: number
  modifierExtraCents?: number
}

export type BillInput = {
  lines: BillLineInput[]
  priceTaxMode: PriceTaxMode
  taxComponents: TaxComponentRates
  discountType?: DiscountType
  discountValue?: number
  serviceChargePercent?: number
  tipCents?: number
}

export type BillTotals = {
  subtotalCents: number
  discountCents: number
  discountedSubtotalCents: number
  taxCents: number
  taxBreakdown: Record<string, number>
  serviceChargeCents: number
  tipCents: number
  totalCents: number
}

export function computeBillTotals(input: BillInput): BillTotals {
  let subtotalCents = 0
  const taxBreakdown: Record<string, number> = {}
  let taxCents = 0

  for (const line of input.lines) {
    const entered = line.enteredUnitPriceCents + (line.modifierExtraCents ?? 0)
    const split = splitLineTax(
      entered,
      line.quantity,
      input.priceTaxMode,
      input.taxComponents,
    )
    subtotalCents += split.preTaxCents
    taxCents += split.taxCents
    for (const [k, v] of Object.entries(split.components)) {
      taxBreakdown[k] = (taxBreakdown[k] ?? 0) + v
    }
  }

  let discountCents = 0
  if (input.discountType === 'PERCENT' && input.discountValue != null) {
    discountCents = Math.round(subtotalCents * (input.discountValue / 100))
  } else if (input.discountType === 'FIXED' && input.discountValue != null) {
    discountCents = input.discountValue
  }
  discountCents = Math.min(discountCents, subtotalCents)

  const discountedSubtotalCents = subtotalCents - discountCents
  const rate = combinedTaxRate(input.taxComponents)
  const adjustedTaxCents = Math.round(discountedSubtotalCents * rate)
  const adjustedBreakdown: Record<string, number> = {}
  const totalPercent = Object.values(input.taxComponents).reduce((a, b) => a + b, 0)
  for (const [key, pct] of Object.entries(input.taxComponents)) {
    adjustedBreakdown[key] =
      totalPercent === 0
        ? 0
        : Math.round(adjustedTaxCents * (pct / totalPercent))
  }

  const serviceChargeCents = input.serviceChargePercent
    ? Math.round(discountedSubtotalCents * (input.serviceChargePercent / 100))
    : 0

  const tipCents = input.tipCents ?? 0

  const totalCents =
    discountedSubtotalCents + adjustedTaxCents + serviceChargeCents + tipCents

  return {
    subtotalCents,
    discountCents,
    discountedSubtotalCents,
    taxCents: adjustedTaxCents,
    taxBreakdown: adjustedBreakdown,
    serviceChargeCents,
    tipCents,
    totalCents,
  }
}
