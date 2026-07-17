import type { TenderType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { assertHubWritable } from '../lib/hub-guard.js'
import { AppError } from '../lib/errors.js'
import { createPayment, listPaymentsByOrder } from '../repositories/payments.js'
import type { PaymentRow } from '../repositories/payments.js'
import { getOrderById, markOrderPaid } from '../repositories/orders.js'
import { getOrderEntry } from './orders.js'

export type RecordPaymentInput = {
  tenderType: TenderType
  amountCents?: number
}

function toPaymentDto(row: PaymentRow) {
  return {
    id: row.id,
    order_id: row.orderId,
    status: row.status,
    amount_cents: row.amountCents,
    tender_type: row.tenderType,
    provider: row.provider,
    provider_ref: row.providerRef,
    version: row.version,
    created_at: row.createdAt,
  }
}

/**
 * Record full payment for a billed order and mark it PAID.
 * MVP requires CHECK_PRINTED status and amount matching order total.
 * @throws {AppError} FORBIDDEN when hub is SUSPENDED; NOT_FOUND; CONFLICT; VALIDATION_ERROR
 */
export function recordOrderPayment(
  db: HubDb,
  locationId: string,
  orderId: string,
  input: RecordPaymentInput,
) {
  assertHubWritable(db, locationId)

  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  if (order.status === 'PAID' || order.status === 'VOID') {
    throw new AppError(
      'CONFLICT',
      'Order is already closed',
      409,
      { order_id: orderId, status: order.status },
    )
  }

  if (order.status !== 'CHECK_PRINTED') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Order must be billed before recording payment',
      400,
      { order_id: orderId, status: order.status },
    )
  }

  const amountCents = input.amountCents ?? order.totalCents
  if (amountCents !== order.totalCents) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Payment amount must match order total',
      400,
      { amount_cents: amountCents, order_total_cents: order.totalCents },
    )
  }

  const existingCaptured = listPaymentsByOrder(db, orderId).some(
    (payment) => payment.status === 'CAPTURED',
  )
  if (existingCaptured) {
    throw new AppError(
      'CONFLICT',
      'Order already has a captured payment',
      409,
      { order_id: orderId },
    )
  }

  const payment = createPayment(db, {
    orderId,
    amountCents,
    tenderType: input.tenderType,
    status: 'CAPTURED',
  })

  const updated = markOrderPaid(db, locationId, orderId)
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  return {
    payment: toPaymentDto(payment),
    order: getOrderEntry(db, locationId, orderId)!,
  }
}
