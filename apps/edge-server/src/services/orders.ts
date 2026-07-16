import type { OrderType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import {
  createOrder,
  getOrderById,
  listOrders,
  type ListOrdersFilter,
} from '../repositories/orders.js'
import { listOrderLines } from '../repositories/order-lines.js'
import { getTableById } from '../repositories/tables.js'
import { getZoneById } from '../repositories/zones.js'
import { toOrderDto } from './orders-dto.js'

export type CreateOrderRequest = {
  orderType: OrderType
  zoneId?: string
  tableId?: string
  customerName?: string | null
  customerContact?: string | null
  serverId?: string | null
}

export function createOrderEntry(
  db: HubDb,
  locationId: string,
  input: CreateOrderRequest,
) {
  if (input.orderType === 'DINE_IN') {
    if (!input.tableId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'table_id is required for DINE_IN orders',
        400,
      )
    }

    const table = getTableById(db, locationId, input.tableId)
    if (!table) {
      throw new AppError('NOT_FOUND', 'Table not found', 404, {
        table_id: input.tableId,
      })
    }

    const row = createOrder(db, locationId, {
      orderType: 'DINE_IN',
      zoneId: table.zoneId,
      tableId: table.id,
      customerName: input.customerName ?? null,
      customerContact: input.customerContact ?? null,
      serverId: input.serverId ?? null,
    })

    return toOrderDto(row, [])
  }

  if (!input.zoneId) {
    throw new AppError(
      'VALIDATION_ERROR',
      'zone_id is required for TAKEAWAY orders',
      400,
    )
  }

  if (!input.customerName?.trim()) {
    throw new AppError(
      'VALIDATION_ERROR',
      'customer_name is required for TAKEAWAY orders',
      400,
    )
  }

  if (!getZoneById(db, locationId, input.zoneId)) {
    throw new AppError('NOT_FOUND', 'Zone not found', 404, {
      zone_id: input.zoneId,
    })
  }

  const row = createOrder(db, locationId, {
    orderType: 'TAKEAWAY',
    zoneId: input.zoneId,
    tableId: null,
    customerName: input.customerName.trim(),
    customerContact: input.customerContact ?? null,
    serverId: input.serverId ?? null,
  })

  return toOrderDto(row, [])
}

export function getOrderEntry(
  db: HubDb,
  locationId: string,
  id: string,
) {
  const row = getOrderById(db, locationId, id)
  if (!row) return null

  return toOrderDto(row, listOrderLines(db, id))
}

export function listOrdersForLocation(
  db: HubDb,
  locationId: string,
  filter: ListOrdersFilter = {},
) {
  return listOrders(db, locationId, filter).map((row) =>
    toOrderDto(row, listOrderLines(db, row.id)),
  )
}

export function parseOrderType(value: string): OrderType {
  if (value === 'DINE_IN' || value === 'TAKEAWAY') {
    return value
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid order_type', 400, {
    order_type: value,
  })
}
