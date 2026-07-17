import { and, asc, eq } from 'drizzle-orm'
import { payments } from '@table-stream/shared-types/hub'
import type { PaymentStatus, TenderType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type PaymentRow = typeof payments.$inferSelect

export type CreatePaymentInput = {
  orderId: string
  amountCents: number
  tenderType: TenderType
  status?: PaymentStatus
}

/** List payments for an order in creation order. */
export function listPaymentsByOrder(db: HubDb, orderId: string): PaymentRow[] {
  return db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(asc(payments.createdAt))
    .all()
}

/** Fetch a payment scoped to its parent order. */
export function getPaymentById(
  db: HubDb,
  orderId: string,
  id: string,
): PaymentRow | undefined {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.orderId, orderId)))
    .get()
}

/** Insert a captured payment row for an order (MVP: manual tender at counter). */
export function createPayment(db: HubDb, input: CreatePaymentInput): PaymentRow {
  const id = newId('pay')
  db.insert(payments)
    .values({
      id,
      orderId: input.orderId,
      amountCents: input.amountCents,
      tenderType: input.tenderType,
      status: input.status ?? 'CAPTURED',
      createdAt: nowSqliteTimestamp(),
    })
    .run()

  const row = getPaymentById(db, input.orderId, id)
  if (!row) {
    throw new Error(`Payment insert failed for ${id}`)
  }
  return row
}
