import type { OrderLineStatus } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { publishHubEvent } from '../lib/hub-events.js'
import {
  getOrderLineByIdGlobal,
  listKdsQueueLines,
  updateOrderLine,
} from '../repositories/order-lines.js'
import { getOrderById } from '../repositories/orders.js'
import { toOrderLineDto } from './orders-dto.js'

const TRANSITIONS: Record<string, OrderLineStatus[]> = {
  QUEUED: ['IN_PROGRESS'],
  IN_PROGRESS: ['PREPARED'],
}

export function listKdsQueue(
  db: HubDb,
  locationId: string,
  options: { stationId?: string } = {},
) {
  const lines = listKdsQueueLines(db, options)
  const items = []

  for (const line of lines) {
    const order = getOrderById(db, locationId, line.orderId)
    if (!order) continue

    items.push({
      ...toOrderLineDto(line),
      order_id: order.id,
      order_type: order.orderType,
      token_number: order.tokenNumber,
      table_id: order.tableId,
    })
  }

  return items
}

export function updateKdsLineStatus(
  db: HubDb,
  locationId: string,
  lineId: string,
  status: OrderLineStatus,
) {
  const line = getOrderLineByIdGlobal(db, lineId)
  if (!line) {
    throw new AppError('NOT_FOUND', 'Order line not found', 404, {
      line_id: lineId,
    })
  }

  const order = getOrderById(db, locationId, line.orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, {
      order_id: line.orderId,
    })
  }

  if (!line.isSubmitted) {
    throw new AppError(
      'CONFLICT',
      'Line has not been submitted to kitchen',
      409,
      { line_id: lineId },
    )
  }

  const allowed = TRANSITIONS[line.status] ?? []
  if (!allowed.includes(status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid status transition from ${line.status} to ${status}`,
      400,
      { from: line.status, to: status },
    )
  }

  const updated = updateOrderLine(db, line.orderId, lineId, {
    status,
    kdsVisible: status === 'PREPARED' ? false : line.kdsVisible,
  })

  const dto = toOrderLineDto(updated!)
  publishHubEvent(locationId, 'line.updated', {
    order_id: line.orderId,
    line_id: lineId,
    status: dto.status,
    kds_visible: dto.kds_visible,
  })

  return dto
}

export function parseKdsLineStatus(value: string): OrderLineStatus {
  if (value === 'IN_PROGRESS' || value === 'PREPARED') {
    return value
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid KDS line status', 400, {
    status: value,
  })
}
