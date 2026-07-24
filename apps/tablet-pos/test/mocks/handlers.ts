import { http, HttpResponse } from 'msw'

type ZoneRecord = {
  id: string
  location_id: string
  name: string
  sort_order: number
  tax_rules: Record<string, number>
  is_active: boolean
  updated_at: string
}

const zones = new Map<string, ZoneRecord>()
let zoneSeq = 0

function resetZonesStore() {
  zones.clear()
  zoneSeq = 0
}

function nowIso() {
  return new Date().toISOString()
}

type ParseTaxRulesResult =
  | { ok: true; rules: Record<string, number> }
  | { ok: false; response: ReturnType<typeof HttpResponse.json> }

function parseTaxRules(raw: unknown): ParseTaxRulesResult {
  if (raw === undefined) return { ok: true, rules: {} }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      response: HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'tax_rules must be an object',
            details: {},
          },
        },
        { status: 400 },
      ),
    }
  }

  const rules: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return {
        ok: false,
        response: HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: `tax_rules.${key} must be a non-negative number`,
              details: {},
            },
          },
          { status: 400 },
        ),
      }
    }
    rules[key] = value
  }
  return { ok: true, rules }
}

/** Default MSW handlers for hub API happy paths used in component tests. */
export const handlers = [
  http.get('*/v1/status', () =>
    HttpResponse.json({
      hub_status: 'ACTIVE',
      location_name: 'Test Location',
      schema_version: '0005_order_bill_tax_snapshot.sql',
      db_ready: true,
      cloud_sync_enabled: false,
      org_id: 'org_test',
      location_id: 'loc_test',
      hub_id: 'hub_test',
      subscription_status: 'ACTIVE',
    }),
  ),

  http.post('*/v1/devices/pair', async ({ request }) => {
    const body = (await request.json()) as {
      pairing_code?: string
      device_type?: string
      name?: string
    }

    if (body.pairing_code !== '123456') {
      return HttpResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired pairing code',
            details: {},
          },
        },
        { status: 401 },
      )
    }

    return HttpResponse.json({
      device: {
        id: 'dev_test',
        location_id: 'loc_test',
        device_type: body.device_type ?? 'COUNTER',
        name: body.name ?? 'Test device',
        is_active: true,
      },
      device_token: 'tok_test',
    })
  }),

  http.get('*/v1/zones', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...zones.values()].filter(
      (zone) => includeInactive || zone.is_active,
    )
    return HttpResponse.json({ zones: list })
  }),

  http.post('*/v1/zones', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
      tax_rules?: unknown
    }
    if (!body.name?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const taxRules = parseTaxRules(body.tax_rules)
    if (!taxRules.ok) return taxRules.response

    const zone: ZoneRecord = {
      id: `zn_${++zoneSeq}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      sort_order: body.sort_order ?? 0,
      tax_rules: taxRules.rules,
      is_active: body.is_active ?? true,
      updated_at: nowIso(),
    }
    zones.set(zone.id, zone)
    return HttpResponse.json({ zone }, { status: 201 })
  }),

  http.patch('*/v1/zones/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = zones.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Zone not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
      tax_rules?: unknown
    }

    let tax_rules = existing.tax_rules
    if (body.tax_rules !== undefined) {
      const parsed = parseTaxRules(body.tax_rules)
      if (!parsed.ok) return parsed.response
      tax_rules = parsed.rules
    }

    const zone: ZoneRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      tax_rules,
      updated_at: nowIso(),
    }
    zones.set(id, zone)
    return HttpResponse.json({ zone })
  }),
]

export { resetZonesStore }
