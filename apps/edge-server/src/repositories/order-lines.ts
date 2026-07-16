import { and, asc, eq } from 'drizzle-orm'
import { orderLines } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'

export type OrderLineRow = typeof orderLines.$inferSelect

export function listOrderLines(db: HubDb, orderId: string): OrderLineRow[] {
  return db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId))
    .orderBy(asc(orderLines.id))
    .all()
}

export function getOrderLineById(
  db: HubDb,
  orderId: string,
  id: string,
): OrderLineRow | undefined {
  return db
    .select()
    .from(orderLines)
    .where(and(eq(orderLines.id, id), eq(orderLines.orderId, orderId)))
    .get()
}

export type CreateOrderLineInput = {
  menuItemId: string
  name: string
  quantity: number
  unitPriceCents: number
  taxCents: number
  lineTotalCents: number
  modifiersJson: string
  tagsJson: string
  specialInstructions?: string | null
  kdsStationId?: string | null
}

export function createOrderLine(
  db: HubDb,
  orderId: string,
  input: CreateOrderLineInput,
): OrderLineRow {
  const id = newId('line')
  db.insert(orderLines)
    .values({
      id,
      orderId,
      menuItemId: input.menuItemId,
      name: input.name,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents,
      taxCents: input.taxCents,
      lineTotalCents: input.lineTotalCents,
      modifiersJson: input.modifiersJson,
      tagsJson: input.tagsJson,
      specialInstructions: input.specialInstructions ?? null,
      kdsStationId: input.kdsStationId ?? null,
      status: 'DRAFT',
      isSubmitted: false,
    })
    .run()

  const row = getOrderLineById(db, orderId, id)
  if (!row) {
    throw new Error(`Order line insert failed for ${id}`)
  }
  return row
}

export type UpdateOrderLineInput = {
  quantity?: number
  unitPriceCents?: number
  taxCents?: number
  lineTotalCents?: number
  modifiersJson?: string
  tagsJson?: string
  specialInstructions?: string | null
}

export function updateOrderLine(
  db: HubDb,
  orderId: string,
  id: string,
  input: UpdateOrderLineInput,
): OrderLineRow | null {
  const existing = getOrderLineById(db, orderId, id)
  if (!existing) return null

  const patch: Partial<typeof orderLines.$inferInsert> = {
    version: existing.version + 1,
  }
  if (input.quantity !== undefined) patch.quantity = input.quantity
  if (input.unitPriceCents !== undefined) {
    patch.unitPriceCents = input.unitPriceCents
  }
  if (input.taxCents !== undefined) patch.taxCents = input.taxCents
  if (input.lineTotalCents !== undefined) {
    patch.lineTotalCents = input.lineTotalCents
  }
  if (input.modifiersJson !== undefined) {
    patch.modifiersJson = input.modifiersJson
  }
  if (input.tagsJson !== undefined) patch.tagsJson = input.tagsJson
  if (input.specialInstructions !== undefined) {
    patch.specialInstructions = input.specialInstructions
  }

  db.update(orderLines)
    .set(patch)
    .where(and(eq(orderLines.id, id), eq(orderLines.orderId, orderId)))
    .run()

  return getOrderLineById(db, orderId, id) ?? null
}

export function deleteOrderLine(
  db: HubDb,
  orderId: string,
  id: string,
): boolean {
  const existing = getOrderLineById(db, orderId, id)
  if (!existing) return false

  db.delete(orderLines)
    .where(and(eq(orderLines.id, id), eq(orderLines.orderId, orderId)))
    .run()

  return true
}
