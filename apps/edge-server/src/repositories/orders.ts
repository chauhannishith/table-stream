import { and, desc, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { orders } from '@table-stream/shared-types/hub'
import type { OrderStatus, OrderType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type OrderRow = typeof orders.$inferSelect

export type ListOrdersFilter = {
  status?: OrderStatus | 'OPEN'
  orderType?: OrderType
  tableId?: string
}

const CLOSED_STATUSES: OrderStatus[] = ['PAID', 'VOID']

export function listOrders(
  db: HubDb,
  locationId: string,
  filter: ListOrdersFilter = {},
): OrderRow[] {
  const conditions = [eq(orders.locationId, locationId)]

  if (filter.status === 'OPEN') {
    conditions.push(isNull(orders.closedAt))
    conditions.push(notInArray(orders.status, CLOSED_STATUSES))
  } else if (filter.status) {
    conditions.push(eq(orders.status, filter.status))
  }

  if (filter.orderType) {
    conditions.push(eq(orders.orderType, filter.orderType))
  }
  if (filter.tableId) {
    conditions.push(eq(orders.tableId, filter.tableId))
  }

  return db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.openedAt))
    .all()
}

export function getOrderById(
  db: HubDb,
  locationId: string,
  id: string,
): OrderRow | undefined {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.locationId, locationId)))
    .get()
}

export type CreateOrderInput = {
  orderType: OrderType
  zoneId: string
  tableId?: string | null
  customerName?: string | null
  customerContact?: string | null
  serverId?: string | null
  status?: OrderStatus
}

export function createOrder(
  db: HubDb,
  locationId: string,
  input: CreateOrderInput,
): OrderRow {
  const id = newId('ord')
  db.insert(orders)
    .values({
      id,
      locationId,
      orderType: input.orderType,
      zoneId: input.zoneId,
      tableId: input.tableId ?? null,
      customerName: input.customerName ?? null,
      customerContact: input.customerContact ?? null,
      serverId: input.serverId ?? null,
      status: input.status ?? 'DRAFT',
      openedAt: nowSqliteTimestamp(),
    })
    .run()

  const row = getOrderById(db, locationId, id)
  if (!row) {
    throw new Error(`Order insert failed for ${id}`)
  }
  return row
}

export type UpdateOrderTotalsInput = {
  subtotalCents: number
  taxCents: number
  totalCents: number
  discountCents?: number
  serviceChargeCents?: number
}

export function updateOrderTotals(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateOrderTotalsInput,
): OrderRow | null {
  const existing = getOrderById(db, locationId, id)
  if (!existing) return null

  db.update(orders)
    .set({
      subtotalCents: input.subtotalCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      discountCents: input.discountCents ?? existing.discountCents,
      serviceChargeCents:
        input.serviceChargeCents ?? existing.serviceChargeCents,
      version: existing.version + 1,
    })
    .where(and(eq(orders.id, id), eq(orders.locationId, locationId)))
    .run()

  return getOrderById(db, locationId, id) ?? null
}

export type UpdateOrderFieldsInput = {
  status?: OrderStatus
  fulfillmentStatus?: string | null
  tokenNumber?: string | null
}

export function updateOrderFields(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateOrderFieldsInput,
): OrderRow | null {
  const existing = getOrderById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof orders.$inferInsert> = {
    version: existing.version + 1,
  }
  if (input.status !== undefined) patch.status = input.status
  if (input.fulfillmentStatus !== undefined) {
    patch.fulfillmentStatus = input.fulfillmentStatus
  }
  if (input.tokenNumber !== undefined) patch.tokenNumber = input.tokenNumber

  db.update(orders)
    .set(patch)
    .where(and(eq(orders.id, id), eq(orders.locationId, locationId)))
    .run()

  return getOrderById(db, locationId, id) ?? null
}

export function listOrdersByIds(
  db: HubDb,
  locationId: string,
  ids: string[],
): OrderRow[] {
  if (ids.length === 0) return []
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.locationId, locationId), inArray(orders.id, ids)))
    .all()
}
