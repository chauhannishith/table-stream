import {
  computeBillTotals,
  splitLineTax,
  type TaxComponentRates,
} from '@table-stream/shared-utils'
import type { DiscountType, PriceTaxMode } from '@table-stream/shared-types/domain'
import type { OrderLineModifierSnapshot } from '../lib/snapshots.js'
import { modifierExtraCents } from '../lib/snapshots.js'
import type { HubDb } from '../db/client.js'
import { getLocationBillingConfig } from '../repositories/location-billing-config.js'

export type BillingConfigSnapshot = {
  priceTaxMode: PriceTaxMode
  taxComponents: TaxComponentRates
}

export type BillPreviewOptions = {
  discountType?: DiscountType
  discountValue?: number
  tipCents?: number
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

export function parseServiceChargePercent(
  rules: Record<string, unknown>,
): number | undefined {
  if (rules.enabled !== true) return undefined
  const percent = rules.percent
  if (typeof percent === 'number' && percent > 0) return percent
  return undefined
}

export function loadBillingConfigSnapshot(
  db: HubDb,
  locationId: string,
): BillingConfigSnapshot {
  const row = getLocationBillingConfig(db, locationId)
  if (!row) {
    return { priceTaxMode: 'EXCLUSIVE', taxComponents: {} }
  }

  return {
    priceTaxMode: row.priceTaxMode as BillingConfigSnapshot['priceTaxMode'],
    taxComponents: parseTaxComponents(
      JSON.parse(row.taxRulesJson) as Record<string, unknown>,
    ),
  }
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

export function computeBillPreview(
  lines: Array<{
    unitPriceCents: number
    quantity: number
    modifiers: OrderLineModifierSnapshot[]
  }>,
  billing: BillingConfigSnapshot,
  serviceChargePercent: number | undefined,
  options: BillPreviewOptions = {},
) {
  return computeBillTotals({
    lines: lines.map((line) => ({
      enteredUnitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      modifierExtraCents: modifierExtraCents(line.modifiers),
    })),
    priceTaxMode: billing.priceTaxMode,
    taxComponents: billing.taxComponents,
    discountType: options.discountType,
    discountValue: options.discountValue,
    serviceChargePercent,
    tipCents: options.tipCents,
  })
}
