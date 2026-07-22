import type { HubConfig } from '../config.js'
import type { HubDb } from '../db/client.js'
import { getEffectiveHubStatus } from '../lib/hub-guard.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'
import { listInvoicesByOrderIds } from '../repositories/invoices.js'
import { listMenuItems } from '../repositories/menu-items.js'
import { listOrderLinesByOrderIds } from '../repositories/order-lines.js'
import { listOrders } from '../repositories/orders.js'
import { listPaymentsByOrderIds } from '../repositories/payments.js'
import { listStaff } from '../repositories/staff.js'
import { toStaffDto } from './floor-setup-dto.js'

export type HubExportArchive = {
  format: 'json_archive_v1'
  exported_at: string
  org_id: string
  location_id: string
  hub_id: string
  hub_status: 'ACTIVE' | 'SUSPENDED'
  invoices: ReturnType<typeof toInvoiceExportRow>[]
  orders: ReturnType<typeof toOrderExportRow>[]
  order_lines: ReturnType<typeof toOrderLineExportRow>[]
  payments: ReturnType<typeof toPaymentExportRow>[]
  staff: ReturnType<typeof toStaffDto>[]
  menu_items: ReturnType<typeof toMenuItemExportRow>[]
  daily_totals: DailyTotalRow[]
}

type DailyTotalRow = {
  date: string
  order_count: number
  subtotal_cents: number
  tax_cents: number
  discount_cents: number
  tip_cents: number
  total_cents: number
}

function toInvoiceExportRow(row: ReturnType<typeof listInvoicesByOrderIds>[number]) {
  return {
    id: row.id,
    order_id: row.orderId,
    payment_id: row.paymentId,
    invoice_number: row.invoiceNumber,
    status: row.status,
    issued_at: row.issuedAt,
    voided_at: row.voidedAt,
    subtotal_cents: row.subtotalCents,
    tax_cents: row.taxCents,
    discount_cents: row.discountCents,
    tip_cents: row.tipCents,
    total_cents: row.totalCents,
    tender_summary: JSON.parse(row.tenderSummaryJson) as Record<string, number>,
    cashier_id: row.cashierId,
    cashier_name: row.cashierName,
    token_number: row.tokenNumber,
    business_snapshot: JSON.parse(row.businessSnapshotJson) as Record<
      string,
      unknown
    >,
    tax_breakdown: JSON.parse(row.taxBreakdownJson) as Record<string, number>,
    content_hash: row.contentHash,
  }
}

function toOrderExportRow(row: ReturnType<typeof listOrders>[number]) {
  return {
    id: row.id,
    order_type: row.orderType,
    status: row.status,
    zone_id: row.zoneId,
    table_id: row.tableId,
    customer_name: row.customerName,
    server_id: row.serverId,
    token_number: row.tokenNumber,
    opened_at: row.openedAt,
    closed_at: row.closedAt,
    subtotal_cents: row.subtotalCents,
    tax_cents: row.taxCents,
    discount_cents: row.discountCents,
    tip_cents: row.tipCents,
    total_cents: row.totalCents,
  }
}

function toOrderLineExportRow(
  row: ReturnType<typeof listOrderLinesByOrderIds>[number],
) {
  return {
    id: row.id,
    order_id: row.orderId,
    menu_item_id: row.menuItemId,
    name: row.name,
    quantity: row.quantity,
    unit_price_cents: row.unitPriceCents,
    tax_cents: row.taxCents,
    line_total_cents: row.lineTotalCents,
    is_submitted: row.isSubmitted,
    modifiers: JSON.parse(row.modifiersJson) as unknown[],
    tags: JSON.parse(row.tagsJson) as unknown[],
    special_instructions: row.specialInstructions,
  }
}

function toPaymentExportRow(
  row: ReturnType<typeof listPaymentsByOrderIds>[number],
) {
  return {
    id: row.id,
    order_id: row.orderId,
    amount_cents: row.amountCents,
    tender_type: row.tenderType,
    status: row.status,
    created_at: row.createdAt,
  }
}

function toMenuItemExportRow(row: ReturnType<typeof listMenuItems>[number]) {
  return {
    id: row.id,
    category_id: row.categoryId,
    name: row.name,
    base_price_cents: row.basePriceCents,
    is_active: row.isActive,
  }
}

/** Derive per-calendar-day totals from PAID orders only. */
export function buildDailyTotals(
  orders: ReturnType<typeof toOrderExportRow>[],
): DailyTotalRow[] {
  const byDate = new Map<string, DailyTotalRow>()

  for (const order of orders) {
    if (order.status !== 'PAID') continue
    const day = (order.closed_at ?? order.opened_at).slice(0, 10)
    const existing = byDate.get(day) ?? {
      date: day,
      order_count: 0,
      subtotal_cents: 0,
      tax_cents: 0,
      discount_cents: 0,
      tip_cents: 0,
      total_cents: 0,
    }
    existing.order_count += 1
    existing.subtotal_cents += order.subtotal_cents
    existing.tax_cents += order.tax_cents
    existing.discount_cents += order.discount_cents
    existing.tip_cents += order.tip_cents
    existing.total_cents += order.total_cents
    byDate.set(day, existing)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Build a local JSON archive of hub data for admin download / suspended mode.
 * Includes PAID orders only (and their lines/payments). Omits secrets
 * (staff PIN hashes, device tokens, customer contact).
 */
export function buildFullHubExport(
  db: HubDb,
  config: HubConfig,
): HubExportArchive {
  const locationId = config.location_id
  const orderRows = listOrders(db, locationId, { status: 'PAID' })
  const orderIds = orderRows.map((row) => row.id)
  const orders = orderRows.map(toOrderExportRow)

  return {
    format: 'json_archive_v1',
    exported_at: nowSqliteTimestamp(),
    org_id: config.org_id,
    location_id: locationId,
    hub_id: config.hub_id,
    hub_status: getEffectiveHubStatus(db, locationId),
    invoices: listInvoicesByOrderIds(db, locationId, orderIds).map(
      toInvoiceExportRow,
    ),
    orders,
    order_lines: listOrderLinesByOrderIds(db, orderIds).map(toOrderLineExportRow),
    payments: listPaymentsByOrderIds(db, orderIds).map(toPaymentExportRow),
    staff: listStaff(db, locationId, { includeInactive: true }).map(toStaffDto),
    menu_items: listMenuItems(db, locationId, { includeInactive: true }).map(
      toMenuItemExportRow,
    ),
    daily_totals: buildDailyTotals(orders),
  }
}
