import { api, type HubApiClient } from './api-client'

export type Zone = {
  id: string
  location_id: string
  name: string
  sort_order: number
  tax_rules: Record<string, number>
  is_active: boolean
  updated_at: string
}

export type ZoneWriteInput = {
  name?: string
  sort_order?: number
  is_active?: boolean
  tax_rules?: Record<string, number>
}

/** Parse tax rule rows into a flat percent map; drops blank keys. */
export function taxRulesFromRows(
  rows: Array<{ key: string; percent: string }>,
): Record<string, number> {
  const rules: Record<string, number> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    const percent = Number(row.percent)
    if (!Number.isFinite(percent) || percent < 0) {
      throw new Error(`tax_rules.${key} must be a non-negative number`)
    }
    rules[key] = percent
  }
  return rules
}

/** Flatten a tax_rules map into editable key/percent rows. */
export function taxRulesToRows(
  rules: Record<string, number>,
): Array<{ key: string; percent: string }> {
  const entries = Object.entries(rules)
  if (entries.length === 0) return [{ key: '', percent: '' }]
  return entries.map(([key, percent]) => ({
    key,
    percent: String(percent),
  }))
}

/** List zones (include inactive for setup reactivation). */
export async function listZones(
  client: HubApiClient = api,
): Promise<Zone[]> {
  const result = await client.get<{ zones: Zone[] }>(
    '/v1/zones?include_inactive=true',
  )
  return result.zones
}

/** Create a zone. */
export async function createZone(
  input: { name: string; tax_rules?: Record<string, number> },
  client: HubApiClient = api,
): Promise<Zone> {
  const body: ZoneWriteInput = { name: input.name.trim() }
  if (input.tax_rules !== undefined) body.tax_rules = input.tax_rules

  const result = await client.post<{ zone: Zone }>('/v1/zones', { body })
  return result.zone
}

/** Patch zone fields (rename, tax_rules, activate/deactivate). */
export async function updateZone(
  id: string,
  input: ZoneWriteInput,
  client: HubApiClient = api,
): Promise<Zone> {
  const body: ZoneWriteInput = {}
  if (input.name !== undefined) body.name = input.name.trim()
  if (input.sort_order !== undefined) body.sort_order = input.sort_order
  if (input.is_active !== undefined) body.is_active = input.is_active
  if (input.tax_rules !== undefined) body.tax_rules = input.tax_rules

  const result = await client.patch<{ zone: Zone }>(`/v1/zones/${id}`, {
    body,
  })
  return result.zone
}
