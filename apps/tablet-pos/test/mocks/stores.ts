import { HttpResponse } from 'msw'

export type ZoneRecord = {
  id: string
  location_id: string
  name: string
  sort_order: number
  tax_rules: Record<string, number>
  is_active: boolean
  updated_at: string
}

export const zones = new Map<string, ZoneRecord>()
let zoneSeq = 0

export function resetZonesStore() {
  zones.clear()
  zoneSeq = 0
}

export type FloorTableRecord = {
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

export const floorTables = new Map<string, FloorTableRecord>()
let tableSeq = 0

export function resetTablesStore() {
  floorTables.clear()
  tableSeq = 0
}

export type OrderRecord = {
  id: string
  location_id: string
  order_type: 'TAKEAWAY' | 'DINE_IN'
  table_id: string | null
  zone_id: string | null
  token_number: string | null
  customer_name: string | null
  customer_contact: string | null
  status: 'DRAFT' | 'SUBMITTED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'CHECK_PRINTED' | 'PAID' | 'VOID'
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

export const orders = new Map<string, OrderRecord>()
let orderSeq = 0
let tokenSeq = 0
let paymentSeq = 0
let invoiceSeq = 0

export type CapturedPaymentRecord = {
  id: string
  order_id: string
  tender_type: string
  amount_cents: number
}

export type InvoiceRecord = {
  id: string
  location_id: string
  order_id: string
  payment_id: string
  invoice_number: string
  status: string
  issued_at: string
  voided_at: null
  void_reason: null
  replaces_invoice_id: null
  subtotal_cents: number
  tax_cents: number
  discount_cents: number
  tip_cents: number
  total_cents: number
  tender_summary: Record<string, number>
  line_items: unknown[]
  cashier_id: null
  cashier_name: string
  token_number: string
  business_snapshot: {
    legal_name: string
    trade_name: null
    gst_number: null
    address_lines: Record<string, never>
    phone: null
    email: null
    logo_path: null
  }
  tax_breakdown: Record<string, number>
  applied_tax_rules: Record<string, number>
  combined_rate_percent: number
  metadata: Record<string, unknown>
  document_path: string
  content_hash: string
}

export const capturedPayments = new Map<string, CapturedPaymentRecord>()
export const invoices = new Map<string, InvoiceRecord>()
export const invoiceByOrder = new Map<string, string>()

export function resetOrdersStore() {
  orders.clear()
  orderSeq = 0
  tokenSeq = 0
  paymentSeq = 0
  invoiceSeq = 0
  capturedPayments.clear()
  invoices.clear()
  invoiceByOrder.clear()
}

export function recalcOrderTotals(order: OrderRecord) {
  order.subtotal_cents = order.lines.reduce(
    (sum, entry) => sum + entry.unit_price_cents * entry.quantity,
    0,
  )
  order.tax_cents = 0
  order.total_cents = order.subtotal_cents
}

export function computeMswBillPreview(
  order: OrderRecord,
  input: {
    discount_type?: string
    discount_value?: number
    tip_cents?: number
  },
) {
  const subtotalCents = order.lines.reduce(
    (sum, entry) => sum + entry.unit_price_cents * entry.quantity,
    0,
  )
  let discountCents = 0
  if (input.discount_type === 'PERCENT' && input.discount_value !== undefined) {
    discountCents = Math.floor((subtotalCents * input.discount_value) / 100)
  } else if (
    input.discount_type === 'FIXED' &&
    input.discount_value !== undefined
  ) {
    discountCents = Math.min(input.discount_value, subtotalCents)
  }
  const discountedSubtotalCents = subtotalCents - discountCents
  const tipCents = input.tip_cents ?? order.tip_cents
  return {
    subtotal_cents: subtotalCents,
    discount_cents: discountCents,
    discounted_subtotal_cents: discountedSubtotalCents,
    tax_cents: 0,
    tax_breakdown: {} as Record<string, number>,
    service_charge_cents: 0,
    tip_cents: tipCents,
    total_cents: discountedSubtotalCents + tipCents,
  }
}

export type OrderLineRecord = {
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

export type CategoryRecord = {
  id: string
  location_id: string
  name: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type MenuItemRecord = {
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

export type MenuTagRecord = {
  id: string
  location_id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type ModifierGroupRecord = {
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

export type ModifierOptionRecord = {
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

export type ZonePriceRecord = {
  zone_id: string
  price_cents: number
  updated_at: string
}

export const categories = new Map<string, CategoryRecord>()
export const menuItems = new Map<string, MenuItemRecord>()
export const menuTags = new Map<string, MenuTagRecord>()
export const modifierGroups = new Map<string, ModifierGroupRecord>()
export const modifierOptions = new Map<string, ModifierOptionRecord>()
/** Key: `${menuItemId}:${zoneId}` */
export const menuItemZonePrices = new Map<string, ZonePriceRecord>()
let categorySeq = 0
let menuItemSeq = 0
let menuTagSeq = 0
let modifierGroupSeq = 0
let modifierOptionSeq = 0

export function zonePriceKey(menuItemId: string, zoneId: string): string {
  return `${menuItemId}:${zoneId}`
}

export function resetMenuStore() {
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

export type StaffRecord = {
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

export const staffMembers = new Map<string, StaffRecord>()
let staffSeq = 0

export function resetStaffStore() {
  staffMembers.clear()
  staffSeq = 0
}

export function toStaffDto(member: StaffRecord) {
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

export function nowIso() {
  return new Date().toISOString()
}

type ParseTaxRulesResult =
  | { ok: true; rules: Record<string, number> }
  | { ok: false; response: ReturnType<typeof HttpResponse.json> }

export function parseTaxRules(raw: unknown): ParseTaxRulesResult {
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

export type BillingConfigRecord = {
  location_id: string
  tax_rules: Record<string, number>
  price_tax_mode: 'INCLUSIVE' | 'EXCLUSIVE'
  service_charge_rules: Record<string, unknown>
  tip_quick_actions: number[]
  updated_at: string | null
}

export function defaultBillingConfig(): BillingConfigRecord {
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

export function resetBillingStore() {
  billingConfig = defaultBillingConfig()
}

export type PrinterRecord = {
  id: string
  location_id: string
  name: string
  role: 'ORDERING' | 'KITCHEN' | 'COLLECTION'
  connection: Record<string, unknown>
  kds_station_ids: string[] | null
  is_active: boolean
  updated_at: string
}

export type PrintConfigRecord = {
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

export const printers = new Map<string, PrinterRecord>()
let printerSeq = 0

export function defaultPrintConfig(): PrintConfigRecord {
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

export function resetPrintersStore() {
  printers.clear()
  printerSeq = 0
  printConfig = defaultPrintConfig()
}

/** Default MSW handlers for hub API happy paths used in component tests. */

export function bumpZoneSeq() {
  return ++zoneSeq
}
export function bumpTableSeq() {
  return ++tableSeq
}
export function bumpOrderSeq() {
  return ++orderSeq
}
export function bumpTokenSeq() {
  return ++tokenSeq
}
export function bumpPaymentSeq() {
  return ++paymentSeq
}
export function bumpInvoiceSeq() {
  return ++invoiceSeq
}
export function bumpCategorySeq() {
  return ++categorySeq
}
export function bumpMenuItemSeq() {
  return ++menuItemSeq
}
export function bumpMenuTagSeq() {
  return ++menuTagSeq
}
export function bumpModifierGroupSeq() {
  return ++modifierGroupSeq
}
export function bumpModifierOptionSeq() {
  return ++modifierOptionSeq
}
export function bumpStaffSeq() {
  return ++staffSeq
}
export function bumpPrinterSeq() {
  return ++printerSeq
}

export function getBillingConfig() {
  return billingConfig
}
export function setBillingConfig(next: typeof billingConfig) {
  billingConfig = next
}
export function getPrintConfig() {
  return printConfig
}
export function setPrintConfig(next: typeof printConfig) {
  printConfig = next
}
