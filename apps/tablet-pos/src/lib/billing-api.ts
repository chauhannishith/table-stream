import { api, type HubApiClient } from './api-client'

export type PriceTaxMode = 'INCLUSIVE' | 'EXCLUSIVE'

export type BillingConfig = {
  location_id: string
  tax_rules: Record<string, number>
  price_tax_mode: PriceTaxMode
  service_charge_rules: Record<string, unknown>
  tip_quick_actions: number[]
  updated_at: string | null
}

export type BillingConfigWriteInput = {
  tax_rules?: Record<string, number>
  price_tax_mode?: PriceTaxMode
  service_charge_rules?: Record<string, unknown>
  tip_quick_actions?: number[]
}

/** Narrow hub price_tax_mode strings; throws on unknown values. */
export function parsePriceTaxMode(raw: string): PriceTaxMode {
  if (raw === 'INCLUSIVE' || raw === 'EXCLUSIVE') return raw
  throw new Error('price_tax_mode must be INCLUSIVE or EXCLUSIVE')
}

/**
 * Build service_charge_rules for PUT.
 * When disabled, only `{ enabled: false }` is sent.
 */
export function serviceChargeRulesFromForm(
  enabled: boolean,
  percentRaw: string,
): Record<string, unknown> {
  if (!enabled) return { enabled: false }
  const trimmed = percentRaw.trim()
  if (!trimmed) {
    throw new Error('service charge percent is required when enabled')
  }
  const percent = Number(trimmed)
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error('service charge percent must be a non-negative number')
  }
  return { enabled: true, percent }
}

/** Parse tip quick-action percent rows; drops blanks. */
export function tipQuickActionsFromRows(
  rows: Array<{ percent: string }>,
): number[] {
  const actions: number[] = []
  for (const row of rows) {
    const trimmed = row.percent.trim()
    if (!trimmed) continue
    const percent = Number(trimmed)
    if (!Number.isFinite(percent) || percent < 0) {
      throw new Error('tip quick action must be a non-negative number')
    }
    actions.push(percent)
  }
  return actions
}

/** Flatten tip_quick_actions into editable percent rows. */
export function tipQuickActionsToRows(
  actions: number[],
): Array<{ percent: string }> {
  if (actions.length === 0) return [{ percent: '' }]
  return actions.map((percent) => ({ percent: String(percent) }))
}

function normalizeBillingConfig(raw: {
  location_id: string
  tax_rules: Record<string, unknown>
  price_tax_mode: string
  service_charge_rules: Record<string, unknown>
  tip_quick_actions: unknown[]
  updated_at: string | null
}): BillingConfig {
  const tax_rules: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw.tax_rules ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      tax_rules[key] = value
    }
  }

  const tip_quick_actions = (raw.tip_quick_actions ?? []).filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  )

  return {
    location_id: raw.location_id,
    tax_rules,
    price_tax_mode: parsePriceTaxMode(raw.price_tax_mode),
    service_charge_rules: raw.service_charge_rules ?? {},
    tip_quick_actions,
    updated_at: raw.updated_at,
  }
}

/** Load location billing config (defaults when unset on hub). */
export async function getBillingConfig(
  client: HubApiClient = api,
): Promise<BillingConfig> {
  const result = await client.get<{
    billing_config: {
      location_id: string
      tax_rules: Record<string, unknown>
      price_tax_mode: string
      service_charge_rules: Record<string, unknown>
      tip_quick_actions: unknown[]
      updated_at: string | null
    }
  }>('/v1/location/billing-config')
  return normalizeBillingConfig(result.billing_config)
}

/** Upsert location billing config fields (partial PUT). */
export async function updateBillingConfig(
  input: BillingConfigWriteInput,
  client: HubApiClient = api,
): Promise<BillingConfig> {
  const body: BillingConfigWriteInput = {}
  if (input.tax_rules !== undefined) body.tax_rules = input.tax_rules
  if (input.price_tax_mode !== undefined) {
    body.price_tax_mode = parsePriceTaxMode(input.price_tax_mode)
  }
  if (input.service_charge_rules !== undefined) {
    body.service_charge_rules = input.service_charge_rules
  }
  if (input.tip_quick_actions !== undefined) {
    body.tip_quick_actions = input.tip_quick_actions
  }

  const result = await client.put<{
    billing_config: {
      location_id: string
      tax_rules: Record<string, unknown>
      price_tax_mode: string
      service_charge_rules: Record<string, unknown>
      tip_quick_actions: unknown[]
      updated_at: string | null
    }
  }>('/v1/location/billing-config', { body })
  return normalizeBillingConfig(result.billing_config)
}
