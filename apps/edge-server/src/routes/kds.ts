import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  getIdempotencyResponse,
  saveIdempotencyResponse,
} from '../repositories/idempotency.js'
import { listKdsQueue, parseKdsLineStatus, updateKdsLineStatus } from '../services/kds.js'
import { submitOrder } from '../services/order-submit.js'

/** Submit draft order lines and cache station-routed KDS entries in Redis. */
export const orderSubmitRoutes: FastifyPluginAsync = async (app) => {
  app.post('/orders/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string }
    const idempotencyKey = request.headers['idempotency-key']
    const key =
      typeof idempotencyKey === 'string' && idempotencyKey.trim()
        ? idempotencyKey.trim()
        : undefined
    const path = `/v1/orders/${id}/submit`

    if (key) {
      const cached = getIdempotencyResponse(
        app.hubDb,
        app.hubConfig.location_id,
        key,
        'POST',
        path,
      )
      if (cached) {
        return reply.status(cached.responseStatus).send(cached.responseBody)
      }
    }

    const result = await submitOrder(
      app.hubDb,
      app.redis,
      app.hubConfig.location_id,
      id,
    )
    const body = { submission: result }

    if (key) {
      saveIdempotencyResponse(
        app.hubDb,
        app.hubConfig.location_id,
        key,
        'POST',
        path,
        200,
        body,
      )
    }

    return reply.send(body)
  })
}

/** Expose KDS queue reads and line-status transitions. */
export const kdsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/kds/queue', async (request) => {
    const query = request.query as { station_id?: string }

    return {
      items: listKdsQueue(
        app.hubDb,
        app.hubConfig.location_id,
        pickDefined({ stationId: query.station_id }),
      ),
    }
  })

  app.patch('/kds/lines/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { status?: string }

    if (!body?.status) {
      throw new AppError('VALIDATION_ERROR', 'status is required', 400)
    }

    const line = await updateKdsLineStatus(
      app.hubDb,
      app.redis,
      app.hubConfig.location_id,
      id,
      parseKdsLineStatus(body.status),
    )

    return reply.send({ line })
  })
}
