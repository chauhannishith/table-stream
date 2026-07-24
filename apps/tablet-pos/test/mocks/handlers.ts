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

type CategoryRecord = {
  id: string
  location_id: string
  name: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

type MenuItemRecord = {
  id: string
  location_id: string
  category_id: string
  name: string
  base_price_cents: number
  unit_price_cents: number
  kds_station_id: string | null
  is_active: boolean
  tag_ids: string[]
  updated_at: string
}

const categories = new Map<string, CategoryRecord>()
const menuItems = new Map<string, MenuItemRecord>()
let categorySeq = 0
let menuItemSeq = 0

function resetMenuStore() {
  categories.clear()
  menuItems.clear()
  categorySeq = 0
  menuItemSeq = 0
}

type StaffRecord = {
  id: string
  location_id: string
  name: string
  role: 'ADMIN' | 'COUNTER' | 'WAITER'
  assigned_zone_ids: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  /** Test-only; never returned in JSON responses. */
  pin: string
}

const staffMembers = new Map<string, StaffRecord>()
let staffSeq = 0

function resetStaffStore() {
  staffMembers.clear()
  staffSeq = 0
}

function toStaffDto(member: StaffRecord) {
  return {
    id: member.id,
    location_id: member.location_id,
    name: member.name,
    role: member.role,
    assigned_zone_ids: member.assigned_zone_ids,
    is_active: member.is_active,
    created_at: member.created_at,
    updated_at: member.updated_at,
  }
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

  http.get('*/v1/menu/categories', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...categories.values()].filter(
      (category) => includeInactive || category.is_active,
    )
    return HttpResponse.json({ categories: list })
  }),

  http.post('*/v1/menu/categories', async ({ request }) => {
    const body = (await request.json()) as { name?: string }
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

    const category: CategoryRecord = {
      id: `cat_${++categorySeq}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      sort_order: 0,
      is_active: true,
      updated_at: nowIso(),
    }
    categories.set(category.id, category)
    return HttpResponse.json({ category }, { status: 201 })
  }),

  http.get('*/v1/menu/items', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...menuItems.values()].filter(
      (item) => includeInactive || item.is_active,
    )
    return HttpResponse.json({ items: list })
  }),

  http.post('*/v1/menu/items', async ({ request }) => {
    const body = (await request.json()) as {
      category_id?: string
      name?: string
      base_price_cents?: number
      is_active?: boolean
    }
    if (!body.category_id || !body.name?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'category_id and name are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (typeof body.base_price_cents !== 'number') {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'base_price_cents is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (!categories.has(body.category_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found',
            details: { category_id: body.category_id },
          },
        },
        { status: 404 },
      )
    }

    const item: MenuItemRecord = {
      id: `mi_${++menuItemSeq}`,
      location_id: 'loc_test',
      category_id: body.category_id,
      name: body.name.trim(),
      base_price_cents: body.base_price_cents,
      unit_price_cents: body.base_price_cents,
      kds_station_id: null,
      is_active: body.is_active ?? true,
      tag_ids: [],
      updated_at: nowIso(),
    }
    menuItems.set(item.id, item)
    return HttpResponse.json({ item }, { status: 201 })
  }),

  http.patch('*/v1/menu/items/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = menuItems.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Menu item not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      category_id?: string
      name?: string
      base_price_cents?: number
      is_active?: boolean
    }

    if (body.category_id && !categories.has(body.category_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found',
            details: { category_id: body.category_id },
          },
        },
        { status: 404 },
      )
    }

    const base_price_cents =
      body.base_price_cents ?? existing.base_price_cents
    const item: MenuItemRecord = {
      ...existing,
      category_id: body.category_id ?? existing.category_id,
      name: body.name?.trim() || existing.name,
      base_price_cents,
      unit_price_cents: base_price_cents,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    menuItems.set(id, item)
    return HttpResponse.json({ item })
  }),

  http.get('*/v1/staff', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...staffMembers.values()]
      .filter((member) => includeInactive || member.is_active)
      .map(toStaffDto)
    return HttpResponse.json({ staff: list })
  }),

  http.post('*/v1/staff', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string
      role?: string
      pin?: string
      is_active?: boolean
    }
    if (!body.name?.trim() || !body.role || !body.pin) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name, role, and pin are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (
      body.role !== 'ADMIN' &&
      body.role !== 'COUNTER' &&
      body.role !== 'WAITER'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid staff role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }
    if (!/^\d{4,8}$/.test(body.pin.trim())) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'PIN must be 4–8 digits',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const timestamp = nowIso()
    const member: StaffRecord = {
      id: `st_${++staffSeq}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      role: body.role,
      assigned_zone_ids: [],
      is_active: body.is_active ?? true,
      created_at: timestamp,
      updated_at: timestamp,
      pin: body.pin.trim(),
    }
    staffMembers.set(member.id, member)
    return HttpResponse.json({ staff: toStaffDto(member) }, { status: 201 })
  }),

  http.patch('*/v1/staff/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = staffMembers.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Staff not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      role?: string
      pin?: string
      is_active?: boolean
    }

    if (
      body.role !== undefined &&
      body.role !== 'ADMIN' &&
      body.role !== 'COUNTER' &&
      body.role !== 'WAITER'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid staff role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }

    if (body.pin !== undefined && !/^\d{4,8}$/.test(body.pin.trim())) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'PIN must be 4–8 digits',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const member: StaffRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      role: (body.role as StaffRecord['role'] | undefined) ?? existing.role,
      pin: body.pin?.trim() || existing.pin,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    staffMembers.set(id, member)
    return HttpResponse.json({ staff: toStaffDto(member) })
  }),
]

export { resetZonesStore, resetMenuStore, resetStaffStore }
