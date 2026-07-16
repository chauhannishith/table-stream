import type { OrderStatus } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { publishHubEvent } from '../lib/hub-events.js'
import {
  listDraftOrderLines,
  nextSubmitBatch,
  submitDraftLines,
} from '../repositories/order-lines.js'
import {
  getOrderById,
  updateOrderFields,
} from '../repositories/orders.js'
import { nextTokenNumber } from '../repositories/token-counters.js'
import { getOrderEntry } from './orders.js'
import { toOrderLineDto } from './orders-dto.js'

function nextOrderStatus(current: string): OrderStatus {
  if (current === 'DRAFT') return 'SUBMITTED'
  if (current === 'SUBMITTED') return 'IN_KITCHEN'
  return current as OrderStatus
}

export function submitOrder(
  db: HubDb,
  locationId: string,
  orderId: string,
) {
  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { id: orderId })
  }

  const drafts = listDraftOrderLines(db, orderId)
  if (drafts.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'No draft lines to submit',
      400,
      { order_id: orderId },
    )
  }

  const submitBatch = nextSubmitBatch(db, orderId)
  const submittedLines = submitDraftLines(
    db,
    orderId,
    drafts.map((line) => line.id),
    submitBatch,
  )

  let tokenNumber = order.tokenNumber
  if (order.orderType === 'TAKEAWAY' && !tokenNumber) {
    tokenNumber = nextTokenNumber(db, locationId, 'TAKEAWAY')
  }

  updateOrderFields(db, locationId, orderId, {
    status: nextOrderStatus(order.status),
    tokenNumber,
    fulfillmentStatus:
      order.orderType === 'TAKEAWAY'
        ? (order.fulfillmentStatus ?? 'IN_QUEUE')
        : order.fulfillmentStatus,
  })

  const updated = getOrderEntry(db, locationId, orderId)!
  const lineDtos = submittedLines.map(toOrderLineDto)

  publishHubEvent(locationId, 'order.submitted', {
    order_id: orderId,
    submit_batch: submitBatch,
    token_number: updated.token_number,
    line_ids: lineDtos.map((line) => line.id),
  })

  return {
    order: updated,
    submit_batch: submitBatch,
    lines: lineDtos,
  }
}
