import type { OrderLineRow } from '../repositories/order-lines.js'
import type { OrderRow } from '../repositories/orders.js'
import type {
  OrderLineModifierSnapshot,
  OrderLineTagSnapshot,
} from '../lib/snapshots.js'

export function toOrderLineDto(row: OrderLineRow) {
  return {
    id: row.id,
    order_id: row.orderId,
    menu_item_id: row.menuItemId,
    name: row.name,
    quantity: row.quantity,
    unit_price_cents: row.unitPriceCents,
    tax_cents: row.taxCents,
    line_total_cents: row.lineTotalCents,
    modifiers: JSON.parse(row.modifiersJson) as OrderLineModifierSnapshot[],
    tags: JSON.parse(row.tagsJson) as OrderLineTagSnapshot[],
    special_instructions: row.specialInstructions,
    kds_station_id: row.kdsStationId,
    status: row.status,
    is_submitted: row.isSubmitted,
    submitted_at: row.submittedAt,
    submit_batch: row.submitBatch,
    kds_visible: row.kdsVisible,
    version: row.version,
  }
}

export function toOrderDto(
  row: OrderRow,
  lines: OrderLineRow[] = [],
) {
  const lineDtos = lines.map(toOrderLineDto)
  return {
    id: row.id,
    location_id: row.locationId,
    order_type: row.orderType,
    table_id: row.tableId,
    zone_id: row.zoneId,
    token_number: row.tokenNumber,
    customer_name: row.customerName,
    customer_contact: row.customerContact,
    status: row.status,
    fulfillment_status: row.fulfillmentStatus,
    server_id: row.serverId,
    discount_type: row.discountType,
    discount_value: row.discountValue,
    discount_cents: row.discountCents,
    service_charge_cents: row.serviceChargeCents,
    tip_cents: row.tipCents,
    version: row.version,
    opened_at: row.openedAt,
    closed_at: row.closedAt,
    subtotal_cents: row.subtotalCents,
    tax_cents: row.taxCents,
    total_cents: row.totalCents,
    lines: lineDtos,
  }
}
