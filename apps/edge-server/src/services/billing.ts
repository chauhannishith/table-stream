import {
  computeBillTotals,
  splitLineTax,
  type TaxComponentRates,
} from '@table-stream/shared-utils'
import type { PriceTaxMode } from '@table-stream/shared-types/domain'
import type { OrderLineModifierSnapshot } from '../lib/snapshots.js'
import { modifierExtraCents } from '../lib/snapshots.js'

export type BillingConfigSnapshot = {
  priceTaxMode: PriceTaxMode
  taxComponents: TaxComponentRates
}

export function parseTaxComponents(
  taxRules: Record<string, unknown>,
): TaxComponentRates {
  const components: TaxComponentRates = {}
  for (const [key, value] of Object.entries(taxRules)) {
    if (typeof value === 'number') {
      components[key] = value
    }
  }
  return components
}

export function computeLineAmounts(input: {
  unitPriceCents: number
  quantity: number
  modifiers: OrderLineModifierSnapshot[]
  billing: BillingConfigSnapshot
}) {
  const extras = modifierExtraCents(input.modifiers)
  const entered = input.unitPriceCents + extras
  const split = splitLineTax(
    entered,
    input.quantity,
    input.billing.priceTaxMode,
    input.billing.taxComponents,
  )

  return {
    unitPriceCents: input.unitPriceCents,
    taxCents: split.taxCents,
    lineTotalCents: split.lineTotalCents,
    modifierExtraCents: extras,
  }
}

export function computeOrderTotalsFromLines(
  lines: Array<{
    unitPriceCents: number
    quantity: number
    modifiers: OrderLineModifierSnapshot[]
  }>,
  billing: BillingConfigSnapshot,
) {
  return computeBillTotals({
    lines: lines.map((line) => ({
      enteredUnitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      modifierExtraCents: modifierExtraCents(line.modifiers),
    })),
    priceTaxMode: billing.priceTaxMode,
    taxComponents: billing.taxComponents,
  })
}
