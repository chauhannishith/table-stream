import {
  computeBillTotals,
  splitLineTax,
  type TaxComponentRates,
} from '@table-stream/shared-utils'
import type { DiscountType, PriceTaxMode } from '@table-stream/shared-types/domain'
import type { OrderLineModifierSnapshot } from '../lib/snapshots.js'
import { modifierExtraCents } from '../lib/snapshots.js'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { getLocationBillingConfig } from '../repositories/location-billing-config.js'
import { getZoneById } from '../repositories/zones.js'

export type BillingConfigSnapshot = {
  priceTaxMode: PriceTaxMode
  taxComponents: TaxComponentRates
}

export type BillPreviewOptions = {
  discountType?: DiscountType
  discountValue?: number
  tipCents?: number
}

/** Extract numeric tax component rates from location billing JSON rules. */
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

/**
 * Validate tax_rules as a map of non-negative numeric component rates.
 * Empty `{}` is allowed (zone inherits location defaults at bill time).
 */
export function parseTaxRulesMap(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError('VALIDATION_ERROR', 'tax_rules must be an object', 400)
  }

  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        `tax_rules.${key} must be a non-negative number`,
        400,
        { key },
      )
    }
    result[key] = value
  }
  return result
}

/** Returns service charge percent when enabled in location rules; otherwise undefined. */
export function parseServiceChargePercent(
  rules: Record<string, unknown>,
): number | undefined {
  if (rules.enabled !== true) return undefined
  const percent = rules.percent
  if (typeof percent === 'number' && percent > 0) return percent
  return undefined
}

function locationTaxComponents(
  db: HubDb,
  locationId: string,
): TaxComponentRates {
  const row = getLocationBillingConfig(db, locationId)
  if (!row) return {}
  return parseTaxComponents(
    JSON.parse(row.taxRulesJson) as Record<string, unknown>,
  )
}

/**
 * Resolve tax components for an order zone.
 * Non-empty zone tax_rules win; empty `{}` inherits location_billing_config.
 */
export function resolveTaxComponentsForZone(
  db: HubDb,
  locationId: string,
  zoneId: string | null | undefined,
): TaxComponentRates {
  if (zoneId) {
    const zone = getZoneById(db, locationId, zoneId)
    if (zone) {
      const zoneComponents = parseTaxComponents(
        JSON.parse(zone.taxRulesJson) as Record<string, unknown>,
      )
      if (Object.keys(zoneComponents).length > 0) {
        return zoneComponents
      }
    }
  }

  return locationTaxComponents(db, locationId)
}

/**
 * Load price/tax mode (location) and tax rates (zone → location fallback).
 * Defaults to exclusive pricing with no tax when billing config is missing.
 */
export function loadBillingConfigSnapshot(
  db: HubDb,
  locationId: string,
  zoneId?: string | null,
): BillingConfigSnapshot {
  const row = getLocationBillingConfig(db, locationId)
  const priceTaxMode = (row?.priceTaxMode ??
    'EXCLUSIVE') as BillingConfigSnapshot['priceTaxMode']

  return {
    priceTaxMode,
    taxComponents: resolveTaxComponentsForZone(db, locationId, zoneId),
  }
}

export type InvoiceTaxSnapshot = {
  /** Tax collected per component, in cents. */
  components: Record<string, number>
  /** Applied percent rates (zone → location resolve). */
  applied_tax_rules: TaxComponentRates
  /** Sum of applied component percents (e.g. 5 for cgst+sgst 2.5 each). */
  combined_rate_percent: number
}

/** Combined percent from tax component rates (e.g. { cgst: 2.5, sgst: 2.5 } → 5). */
export function combinedRatePercent(components: TaxComponentRates): number {
  return Object.values(components).reduce((sum, pct) => sum + pct, 0)
}

/** Build frozen invoice tax snapshot for print/export. */
export function buildInvoiceTaxSnapshot(
  components: Record<string, number>,
  appliedTaxRules: TaxComponentRates,
): InvoiceTaxSnapshot {
  return {
    components,
    applied_tax_rules: { ...appliedTaxRules },
    combined_rate_percent: combinedRatePercent(appliedTaxRules),
  }
}

/**
 * Parse tax_breakdown_json — supports E11.4 snapshot shape and legacy flat component maps.
 */
export function parseInvoiceTaxSnapshot(raw: unknown): InvoiceTaxSnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      components: {},
      applied_tax_rules: {},
      combined_rate_percent: 0,
    }
  }

  const obj = raw as Record<string, unknown>
  if (
    obj.components &&
    typeof obj.components === 'object' &&
    !Array.isArray(obj.components)
  ) {
    const components = obj.components as Record<string, number>
    const applied =
      obj.applied_tax_rules &&
      typeof obj.applied_tax_rules === 'object' &&
      !Array.isArray(obj.applied_tax_rules)
        ? (obj.applied_tax_rules as TaxComponentRates)
        : {}
    const combined =
      typeof obj.combined_rate_percent === 'number'
        ? obj.combined_rate_percent
        : combinedRatePercent(applied)
    return {
      components,
      applied_tax_rules: applied,
      combined_rate_percent: combined,
    }
  }

  // Legacy: flat { cgst: cents, sgst: cents }
  const components: Record<string, number> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') components[key] = value
  }
  return {
    components,
    applied_tax_rules: {},
    combined_rate_percent: 0,
  }
}

/** Aggregate invoice tax cents by combined rate percent (for export/reporting). */
export function aggregateTaxByCombinedRate(
  rows: Array<{
    tax_cents: number
    combined_rate_percent: number
  }>,
): Array<{
  combined_rate_percent: number
  tax_cents: number
  invoice_count: number
}> {
  const byRate = new Map<
    number,
    { combined_rate_percent: number; tax_cents: number; invoice_count: number }
  >()

  for (const row of rows) {
    const key = row.combined_rate_percent
    const existing = byRate.get(key) ?? {
      combined_rate_percent: key,
      tax_cents: 0,
      invoice_count: 0,
    }
    existing.tax_cents += row.tax_cents
    existing.invoice_count += 1
    byRate.set(key, existing)
  }

  return [...byRate.values()].sort(
    (a, b) => a.combined_rate_percent - b.combined_rate_percent,
  )
}

/** Compute per-line tax and total from snapshotted unit price and modifiers. */
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

/** Sum order line snapshots into subtotal/tax/total using shared-utils billing math. */
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

/** Preview bill totals with discount, service charge, and tip — does not persist to the order. */
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
    ...(options.discountType !== undefined
      ? { discountType: options.discountType }
      : {}),
    ...(options.discountValue !== undefined
      ? { discountValue: options.discountValue }
      : {}),
    ...(serviceChargePercent !== undefined
      ? { serviceChargePercent }
      : {}),
    ...(options.tipCents !== undefined ? { tipCents: options.tipCents } : {}),
  })
}
