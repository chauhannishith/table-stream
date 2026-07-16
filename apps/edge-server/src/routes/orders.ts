import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  addLine,
  removeDraftLine,
  updateDraftLine,
} from '../services/order-lines.js'
import {
  createOrderEntry,
  getOrderEntry,
  listOrdersForLocation,
  parseOrderType,
} from '../services/orders.js'
import type { OrderStatus } from '@table-stream/shared-types/domain'

function parseListStatus(
  value: string | undefined,
): OrderStatus | 'OPEN' | undefined {
  if (!value) return undefined
  if (value === 'OPEN') return 'OPEN'
  const allowed: OrderStatus[] = [
    'DRAFT',
    'SUBMITTED',
    'IN_KITCHEN',
    'SERVED',
    'CHECK_PRINTED',
    'PAID',
    'VOID',
  ]
  if (allowed.includes(value as OrderStatus)) {
    return value as OrderStatus
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid status filter', 400, {
    status: value,
  })
}

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orders', async (request) => {
    const query = request.query as {
      status?: string
      order_type?: string
      table_id?: string
    }

    return {
      orders: listOrdersForLocation(
        app.hubDb,
        app.hubConfig.location_id,
        pickDefined({
          status: parseListStatus(query.status),
          orderType: query.order_type
            ? parseOrderType(query.order_type)
            : undefined,
          tableId: query.table_id,
        }),
      ),
    }
  })

  app.post('/orders', async (request, reply) => {
    const body = request.body as {
      order_type?: string
      zone_id?: string
      table_id?: string
      customer_name?: string | null
      customer_contact?: string | null
      server_id?: string | null
    }

    if (!body?.order_type) {
      throw new AppError('VALIDATION_ERROR', 'order_type is required', 400)
    }

    const order = createOrderEntry(app.hubDb, app.hubConfig.location_id, {
      orderType: parseOrderType(body.order_type),
      ...pickDefined({
        zoneId: body.zone_id,
        tableId: body.table_id,
        customerName: body.customer_name,
        customerContact: body.customer_contact,
        serverId: body.server_id,
      }),
    })

    return reply.status(201).send({ order })
  })

  app.get('/orders/:id', async (request) => {
    const { id } = request.params as { id: string }
    const order = getOrderEntry(app.hubDb, app.hubConfig.location_id, id)
    if (!order) {
      throw new AppError('NOT_FOUND', 'Order not found', 404, { id })
    }
    return { order }
  })

  app.post('/orders/:id/lines', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      menu_item_id?: string
      quantity?: number
      modifiers?: Array<{ option_id: string; quantity?: number }>
      special_instructions?: string | null
    }

    if (!body?.menu_item_id) {
      throw new AppError('VALIDATION_ERROR', 'menu_item_id is required', 400)
    }

    const line = addLine(app.hubDb, app.hubConfig.location_id, id, {
      menuItemId: body.menu_item_id,
      ...pickDefined({
        quantity: body.quantity,
        modifiers: body.modifiers,
        specialInstructions: body.special_instructions,
      }),
    })

    return reply.status(201).send({ line })
  })

  app.patch('/orders/:id/lines/:lineId', async (request, reply) => {
    const { id, lineId } = request.params as { id: string; lineId: string }
    const body = request.body as {
      quantity?: number
      modifiers?: Array<{ option_id: string; quantity?: number }>
      special_instructions?: string | null
    }

    const line = updateDraftLine(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      lineId,
      pickDefined({
        quantity: body?.quantity,
        modifiers: body?.modifiers,
        specialInstructions: body?.special_instructions,
      }),
    )

    return reply.send({ line })
  })

  app.delete('/orders/:id/lines/:lineId', async (request, reply) => {
    const { id, lineId } = request.params as { id: string; lineId: string }
    removeDraftLine(app.hubDb, app.hubConfig.location_id, id, lineId)
    return reply.status(204).send()
  })
}
