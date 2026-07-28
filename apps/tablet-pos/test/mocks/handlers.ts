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

type FloorTableRecord = {
  id: string
  location_id: string
  zone_id: string
  label: string
  capacity: number
  pos_x: number | null
  pos_y: number | null
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY'
  version: number
  updated_at: string
}

const floorTables = new Map<string, FloorTableRecord>()
let tableSeq = 0

function resetTablesStore() {
  floorTables.clear()
  tableSeq = 0
}

type OrderRecord = {
  id: string
  location_id: string
  order_type: 'TAKEAWAY' | 'DINE_IN'
  table_id: string | null
  zone_id: string | null
  token_number: string | null
  customer_name: string | null
  customer_contact: string | null
  status: 'DRAFT' | 'SUBMITTED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'PAID'
  fulfillment_status: 'IN_QUEUE' | 'PREPARING' | 'READY' | 'SERVED' | 'COLLECTED'
  server_id: string | null
  discount_type: string | null
  discount_value: number | null
  discount_cents: number
  service_charge_cents: number
  tip_cents: number
  version: number
  opened_at: string
  closed_at: string | null
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  lines: OrderLineRecord[]
}

const orders = new Map<string, OrderRecord>()
let orderSeq = 0

function resetOrdersStore() {
  orders.clear()
  orderSeq = 0
}

type OrderLineRecord = {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  quantity: number
  unit_price_cents: number
  tax_cents: number
  line_total_cents: number
  modifiers: unknown[]
  tags: unknown[]
  special_instructions: string | null
  kds_station_id: string | null
  status: string
  is_submitted: boolean
  submitted_at: string | null
  submit_batch: number
  kds_visible: boolean
  version: number
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

type MenuTagRecord = {
  id: string
  location_id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

type ModifierGroupRecord = {
  id: string
  location_id: string
  scope: 'CATEGORY' | 'ITEM'
  category_id: string | null
  menu_item_id: string | null
  name: string
  min_select: number
  max_select: number | null
  is_required: boolean
  sort_order: number
  is_active: boolean
  updated_at: string
}

type ModifierOptionRecord = {
  id: string
  group_id: string
  code: string
  label: string
  price_cents: number
  is_default: boolean
  sort_order: number
  is_active: boolean
  updated_at: string
}

type ZonePriceRecord = {
  zone_id: string
  price_cents: number
  updated_at: string
}

const categories = new Map<string, CategoryRecord>()
const menuItems = new Map<string, MenuItemRecord>()
const menuTags = new Map<string, MenuTagRecord>()
const modifierGroups = new Map<string, ModifierGroupRecord>()
const modifierOptions = new Map<string, ModifierOptionRecord>()
/** Key: `${menuItemId}:${zoneId}` */
const menuItemZonePrices = new Map<string, ZonePriceRecord>()
let categorySeq = 0
let menuItemSeq = 0
let menuTagSeq = 0
let modifierGroupSeq = 0
let modifierOptionSeq = 0

function zonePriceKey(menuItemId: string, zoneId: string): string {
  return `${menuItemId}:${zoneId}`
}

function resetMenuStore() {
  categories.clear()
  menuItems.clear()
  menuTags.clear()
  modifierGroups.clear()
  modifierOptions.clear()
  menuItemZonePrices.clear()
  categorySeq = 0
  menuItemSeq = 0
  menuTagSeq = 0
  modifierGroupSeq = 0
  modifierOptionSeq = 0
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

type BillingConfigRecord = {
  location_id: string
  tax_rules: Record<string, number>
  price_tax_mode: 'INCLUSIVE' | 'EXCLUSIVE'
  service_charge_rules: Record<string, unknown>
  tip_quick_actions: number[]
  updated_at: string | null
}

function defaultBillingConfig(): BillingConfigRecord {
  return {
    location_id: 'loc_test',
    tax_rules: {},
    price_tax_mode: 'EXCLUSIVE',
    service_charge_rules: {},
    tip_quick_actions: [],
    updated_at: null,
  }
}

let billingConfig = defaultBillingConfig()

function resetBillingStore() {
  billingConfig = defaultBillingConfig()
}

type PrinterRecord = {
  id: string
  location_id: string
  name: string
  role: 'ORDERING' | 'KITCHEN' | 'COLLECTION'
  connection: Record<string, unknown>
  kds_station_ids: string[] | null
  is_active: boolean
  updated_at: string
}

type PrintConfigRecord = {
  location_id: string
  print_stages: {
    ordering: { enabled: boolean; auto_on_bill: boolean }
    kitchen: {
      enabled: boolean
      auto_on_submit: boolean
      split_by_station: boolean
      split_by_token: boolean
    }
    collection: {
      enabled: boolean
      auto_print_dine_in: boolean
      auto_print_takeaway: boolean
      trigger: 'at_counter' | 'packed' | 'manual_only'
    }
  }
  updated_at: string | null
}

const printers = new Map<string, PrinterRecord>()
let printerSeq = 0

function defaultPrintConfig(): PrintConfigRecord {
  return {
    location_id: 'loc_test',
    print_stages: {
      ordering: { enabled: true, auto_on_bill: true },
      kitchen: {
        enabled: true,
        auto_on_submit: true,
        split_by_station: true,
        split_by_token: true,
      },
      collection: {
        enabled: true,
        auto_print_dine_in: false,
        auto_print_takeaway: true,
        trigger: 'at_counter',
      },
    },
    updated_at: null,
  }
}

let printConfig = defaultPrintConfig()

function resetPrintersStore() {
  printers.clear()
  printerSeq = 0
  printConfig = defaultPrintConfig()
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

  http.get('*/v1/location/billing-config', () =>
    HttpResponse.json({ billing_config: billingConfig }),
  ),

  http.put('*/v1/location/billing-config', async ({ request }) => {
    const body = (await request.json()) as {
      tax_rules?: unknown
      price_tax_mode?: string
      service_charge_rules?: Record<string, unknown>
      tip_quick_actions?: number[]
    }

    const parsedTaxRules =
      body.tax_rules === undefined
        ? { ok: true as const, rules: billingConfig.tax_rules }
        : parseTaxRules(body.tax_rules)
    if (!parsedTaxRules.ok) return parsedTaxRules.response

    if (
      body.price_tax_mode !== undefined &&
      body.price_tax_mode !== 'INCLUSIVE' &&
      body.price_tax_mode !== 'EXCLUSIVE'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid price_tax_mode',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    billingConfig = {
      ...billingConfig,
      tax_rules: parsedTaxRules.rules,
      price_tax_mode:
        body.price_tax_mode ?? billingConfig.price_tax_mode,
      service_charge_rules:
        body.service_charge_rules ?? billingConfig.service_charge_rules,
      tip_quick_actions:
        body.tip_quick_actions ?? billingConfig.tip_quick_actions,
      updated_at: nowIso(),
    }
    return HttpResponse.json({ billing_config: billingConfig })
  }),

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

  http.get('*/v1/tables', ({ request }) => {
    const zoneId = new URL(request.url).searchParams.get('zone_id')
    const list = [...floorTables.values()].filter(
      (table) => !zoneId || table.zone_id === zoneId,
    )
    return HttpResponse.json({ tables: list })
  }),

  http.post('*/v1/tables', async ({ request }) => {
    const body = (await request.json()) as {
      zone_id?: string
      label?: string
      capacity?: number
      pos_x?: number | null
      pos_y?: number | null
    }
    if (!body.zone_id || !body.label?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'zone_id and label are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (!zones.has(body.zone_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Zone not found',
            details: { zone_id: body.zone_id },
          },
        },
        { status: 404 },
      )
    }

    const table: FloorTableRecord = {
      id: `tbl_${++tableSeq}`,
      location_id: 'loc_test',
      zone_id: body.zone_id,
      label: body.label.trim(),
      capacity: body.capacity ?? 2,
      pos_x: body.pos_x ?? null,
      pos_y: body.pos_y ?? null,
      status: 'AVAILABLE',
      version: 1,
      updated_at: nowIso(),
    }
    floorTables.set(table.id, table)
    return HttpResponse.json({ table }, { status: 201 })
  }),

  http.post('*/v1/orders', async ({ request }) => {
    const body = (await request.json()) as {
      order_type?: string
      zone_id?: string
      table_id?: string
      customer_name?: string | null
      customer_contact?: string | null
    }

    if (body.order_type === 'TAKEAWAY') {
      const customerName = body.customer_name?.trim() ?? ''
      if (!body.zone_id || !customerName) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'zone_id and customer_name are required for TAKEAWAY',
              details: {},
            },
          },
          { status: 400 },
        )
      }
      if (!zones.has(body.zone_id)) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Zone not found',
              details: { zone_id: body.zone_id },
            },
          },
          { status: 404 },
        )
      }

      const order: OrderRecord = {
        id: `ord_${++orderSeq}`,
        location_id: 'loc_test',
        order_type: 'TAKEAWAY',
        table_id: null,
        zone_id: body.zone_id,
        token_number: null,
        customer_name: customerName,
        customer_contact: body.customer_contact?.trim() || null,
        status: 'DRAFT',
        fulfillment_status: 'IN_QUEUE',
        server_id: null,
        discount_type: null,
        discount_value: null,
        discount_cents: 0,
        service_charge_cents: 0,
        tip_cents: 0,
        version: 1,
        opened_at: nowIso(),
        closed_at: null,
        subtotal_cents: 0,
        tax_cents: 0,
        total_cents: 0,
        lines: [],
      }
      orders.set(order.id, order)
      return HttpResponse.json({ order }, { status: 201 })
    }

    return HttpResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Unsupported order_type in MSW stub',
          details: {},
        },
      },
      { status: 400 },
    )
  }),

  http.get('*/v1/orders/:id', ({ params }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }
    return HttpResponse.json({ order })
  }),

  http.post('*/v1/orders/:id/lines', async ({ params, request }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      menu_item_id?: string
      quantity?: number
    }
    if (!body.menu_item_id) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'menu_item_id is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const item = menuItems.get(body.menu_item_id)
    if (!item) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Menu item not found',
            details: { menu_item_id: body.menu_item_id },
          },
        },
        { status: 404 },
      )
    }

    const quantity = body.quantity ?? 1
    const zonePrice = order.zone_id
      ? menuItemZonePrices.get(zonePriceKey(item.id, order.zone_id))
      : undefined
    const unitPriceCents = zonePrice?.price_cents ?? item.base_price_cents
    const lineTotalCents = unitPriceCents * quantity
    const line: OrderLineRecord = {
      id: `line_${order.lines.length + 1}`,
      order_id: order.id,
      menu_item_id: item.id,
      name: item.name,
      quantity,
      unit_price_cents: unitPriceCents,
      tax_cents: 0,
      line_total_cents: lineTotalCents,
      modifiers: [],
      tags: [],
      special_instructions: null,
      kds_station_id: item.kds_station_id,
      status: 'DRAFT',
      is_submitted: false,
      submitted_at: null,
      submit_batch: 0,
      kds_visible: false,
      version: 1,
    }

    order.lines = [...order.lines, line]
    order.subtotal_cents = order.lines.reduce(
      (sum, entry) => sum + entry.unit_price_cents * entry.quantity,
      0,
    )
    order.tax_cents = 0
    order.total_cents = order.subtotal_cents
    order.version += 1
    orders.set(order.id, order)

    return HttpResponse.json({ line }, { status: 201 })
  }),

  http.patch('*/v1/tables/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = floorTables.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Table not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      zone_id?: string
      label?: string
      capacity?: number
      pos_x?: number | null
      pos_y?: number | null
      status?: FloorTableRecord['status']
    }

    if (body.zone_id !== undefined && !zones.has(body.zone_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Zone not found',
            details: { zone_id: body.zone_id },
          },
        },
        { status: 404 },
      )
    }

    const table: FloorTableRecord = {
      ...existing,
      zone_id: body.zone_id ?? existing.zone_id,
      label: body.label?.trim() || existing.label,
      capacity: body.capacity ?? existing.capacity,
      pos_x: body.pos_x !== undefined ? body.pos_x : existing.pos_x,
      pos_y: body.pos_y !== undefined ? body.pos_y : existing.pos_y,
      status: body.status ?? existing.status,
      version: existing.version + 1,
      updated_at: nowIso(),
    }
    floorTables.set(id, table)
    return HttpResponse.json({ table })
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

  http.patch('*/v1/menu/categories/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = categories.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found',
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
    }

    const category: CategoryRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    categories.set(id, category)
    return HttpResponse.json({ category })
  }),

  http.get('*/v1/menu/items', ({ request }) => {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('include_inactive') === 'true'
    const zoneId = url.searchParams.get('zone_id')
    const list = [...menuItems.values()]
      .filter((item) => includeInactive || item.is_active)
      .map((item) => {
        if (!zoneId) return item
        const override = menuItemZonePrices.get(zonePriceKey(item.id, zoneId))
        return {
          ...item,
          unit_price_cents: override?.price_cents ?? item.base_price_cents,
        }
      })
    return HttpResponse.json({ items: list })
  }),

  http.put('*/v1/menu/items/:id/zone-prices', async ({ params, request }) => {
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
      prices?: Array<{ zone_id: string; price_cents: number }>
    }
    if (!Array.isArray(body?.prices)) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'prices array is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    for (const price of body.prices) {
      if (!zones.has(price.zone_id)) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Zone not found',
              details: { zone_id: price.zone_id },
            },
          },
          { status: 404 },
        )
      }
      menuItemZonePrices.set(zonePriceKey(id, price.zone_id), {
        zone_id: price.zone_id,
        price_cents: price.price_cents,
        updated_at: nowIso(),
      })
    }

    const prices = [...menuItemZonePrices.entries()]
      .filter(([key]) => key.startsWith(`${id}:`))
      .map(([, row]) => row)
    return HttpResponse.json({ prices })
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

  http.get('*/v1/menu/tags', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...menuTags.values()].filter(
      (tag) => includeInactive || tag.is_active,
    )
    return HttpResponse.json({ tags: list })
  }),

  http.post('*/v1/menu/tags', async ({ request }) => {
    const body = (await request.json()) as { code?: string; label?: string }
    if (!body.code?.trim() || !body.label?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'code and label are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const code = body.code.trim()
    const duplicate = [...menuTags.values()].some((tag) => tag.code === code)
    if (duplicate) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Tag code already exists',
            details: { code },
          },
        },
        { status: 409 },
      )
    }

    const tag: MenuTagRecord = {
      id: `tag_${++menuTagSeq}`,
      location_id: 'loc_test',
      code,
      label: body.label.trim(),
      sort_order: 0,
      is_active: true,
      updated_at: nowIso(),
    }
    menuTags.set(tag.id, tag)
    return HttpResponse.json({ tag }, { status: 201 })
  }),

  http.patch('*/v1/menu/tags/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = menuTags.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Tag not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      code?: string
      label?: string
      sort_order?: number
      is_active?: boolean
    }

    const code = body.code?.trim() || existing.code
    const duplicate = [...menuTags.values()].some(
      (tag) => tag.id !== id && tag.code === code,
    )
    if (duplicate) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Tag code already exists',
            details: { code },
          },
        },
        { status: 409 },
      )
    }

    const tag: MenuTagRecord = {
      ...existing,
      code,
      label: body.label?.trim() || existing.label,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    menuTags.set(id, tag)
    return HttpResponse.json({ tag })
  }),

  http.get('*/v1/menu/modifier-groups', ({ request }) => {
    const url = new URL(request.url)
    const includeInactive =
      url.searchParams.get('include_inactive') === 'true'
    const menuItemId = url.searchParams.get('menu_item_id')
    const categoryId = url.searchParams.get('category_id')
    const list = [...modifierGroups.values()].filter((group) => {
      if (!includeInactive && !group.is_active) return false
      if (menuItemId && group.menu_item_id !== menuItemId) return false
      if (categoryId && group.category_id !== categoryId) return false
      return true
    })
    return HttpResponse.json({ modifier_groups: list })
  }),

  http.post('*/v1/menu/modifier-groups', async ({ request }) => {
    const body = (await request.json()) as {
      scope?: 'CATEGORY' | 'ITEM'
      category_id?: string
      menu_item_id?: string
      name?: string
      min_select?: number
      max_select?: number | null
      is_required?: boolean
      sort_order?: number
      is_active?: boolean
    }
    if (!body.scope || !body.name?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'scope and name are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (body.scope === 'ITEM' && !body.menu_item_id) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'menu_item_id is required for ITEM scope',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (body.scope === 'CATEGORY' && !body.category_id) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'category_id is required for CATEGORY scope',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const group: ModifierGroupRecord = {
      id: `mg_${++modifierGroupSeq}`,
      location_id: 'loc_test',
      scope: body.scope,
      category_id: body.category_id ?? null,
      menu_item_id: body.menu_item_id ?? null,
      name: body.name.trim(),
      min_select: body.min_select ?? 0,
      max_select: body.max_select ?? null,
      is_required: body.is_required ?? false,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      updated_at: nowIso(),
    }
    modifierGroups.set(group.id, group)
    return HttpResponse.json({ modifier_group: group }, { status: 201 })
  }),

  http.patch('*/v1/menu/modifier-groups/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = modifierGroups.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'modifier group not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      min_select?: number
      max_select?: number | null
      is_required?: boolean
      sort_order?: number
      is_active?: boolean
    }

    const group: ModifierGroupRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      min_select: body.min_select ?? existing.min_select,
      max_select:
        body.max_select !== undefined ? body.max_select : existing.max_select,
      is_required: body.is_required ?? existing.is_required,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    modifierGroups.set(id, group)
    return HttpResponse.json({ modifier_group: group })
  }),

  http.get('*/v1/menu/modifier-groups/:id/options', ({ params, request }) => {
    const groupId = String(params.id)
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...modifierOptions.values()].filter((option) => {
      if (option.group_id !== groupId) return false
      return includeInactive || option.is_active
    })
    return HttpResponse.json({ options: list })
  }),

  http.post(
    '*/v1/menu/modifier-groups/:id/options',
    async ({ params, request }) => {
      const groupId = String(params.id)
      if (!modifierGroups.has(groupId)) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'modifier group not found',
              details: { id: groupId },
            },
          },
          { status: 404 },
        )
      }

      const body = (await request.json()) as {
        code?: string
        label?: string
        price_cents?: number
        is_default?: boolean
        sort_order?: number
        is_active?: boolean
      }
      if (!body.code?.trim() || !body.label?.trim()) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'code and label are required',
              details: {},
            },
          },
          { status: 400 },
        )
      }

      const option: ModifierOptionRecord = {
        id: `mo_${++modifierOptionSeq}`,
        group_id: groupId,
        code: body.code.trim(),
        label: body.label.trim(),
        price_cents: body.price_cents ?? 0,
        is_default: body.is_default ?? false,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
        updated_at: nowIso(),
      }
      modifierOptions.set(option.id, option)
      return HttpResponse.json({ option }, { status: 201 })
    },
  ),

  http.patch('*/v1/menu/modifier-options/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = modifierOptions.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'modifier option not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      code?: string
      label?: string
      price_cents?: number
      is_default?: boolean
      sort_order?: number
      is_active?: boolean
    }

    const option: ModifierOptionRecord = {
      ...existing,
      code: body.code?.trim() || existing.code,
      label: body.label?.trim() || existing.label,
      price_cents: body.price_cents ?? existing.price_cents,
      is_default: body.is_default ?? existing.is_default,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    modifierOptions.set(id, option)
    return HttpResponse.json({ option })
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

  http.get('*/v1/printers', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...printers.values()].filter(
      (printer) => includeInactive || printer.is_active,
    )
    return HttpResponse.json({ printers: list })
  }),

  http.post('*/v1/printers', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string
      role?: string
      connection?: Record<string, unknown>
      kds_station_ids?: string[] | null
      is_active?: boolean
    }
    if (!body.name?.trim() || !body.role) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name and role are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (
      body.role !== 'ORDERING' &&
      body.role !== 'KITCHEN' &&
      body.role !== 'COLLECTION'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid printer role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }

    const printer: PrinterRecord = {
      id: `prn_${++printerSeq}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      role: body.role,
      connection: body.connection ?? {},
      kds_station_ids: body.kds_station_ids ?? null,
      is_active: body.is_active ?? true,
      updated_at: nowIso(),
    }
    printers.set(printer.id, printer)
    return HttpResponse.json({ printer }, { status: 201 })
  }),

  http.patch('*/v1/printers/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = printers.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Printer not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      role?: string
      connection?: Record<string, unknown>
      kds_station_ids?: string[] | null
      is_active?: boolean
    }

    if (
      body.role !== undefined &&
      body.role !== 'ORDERING' &&
      body.role !== 'KITCHEN' &&
      body.role !== 'COLLECTION'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid printer role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }

    const printer: PrinterRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      role: (body.role as PrinterRecord['role'] | undefined) ?? existing.role,
      connection: body.connection ?? existing.connection,
      kds_station_ids:
        body.kds_station_ids !== undefined
          ? body.kds_station_ids
          : existing.kds_station_ids,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    printers.set(id, printer)
    return HttpResponse.json({ printer })
  }),

  http.get('*/v1/location/print-config', () =>
    HttpResponse.json({ print_config: printConfig }),
  ),

  http.put('*/v1/location/print-config', async ({ request }) => {
    const body = (await request.json()) as { print_stages?: unknown }
    if (body.print_stages === undefined) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'print_stages is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const stages = body.print_stages as PrintConfigRecord['print_stages']
    if (
      !stages?.ordering ||
      !stages?.kitchen ||
      !stages?.collection ||
      typeof stages.ordering.enabled !== 'boolean' ||
      typeof stages.kitchen.enabled !== 'boolean' ||
      typeof stages.collection.enabled !== 'boolean'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid print_stages config',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    printConfig = {
      location_id: 'loc_test',
      print_stages: stages,
      updated_at: nowIso(),
    }
    return HttpResponse.json({ print_config: printConfig })
  }),
]

export {
  resetBillingStore,
  resetZonesStore,
  resetTablesStore,
  resetOrdersStore,
  resetMenuStore,
  resetStaffStore,
  resetPrintersStore,
}
