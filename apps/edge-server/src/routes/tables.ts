import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createTableEntry,
  listTablesForLocation,
  parseTableStatus,
  updateTableEntry,
} from '../services/floor-setup.js'

export const tableRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tables', async (request) => {
    const query = request.query as { zone_id?: string }

    return {
      tables: listTablesForLocation(app.hubDb, app.hubConfig.location_id, {
        zoneId: query.zone_id,
      }),
    }
  })

  app.post('/tables', async (request, reply) => {
    const body = request.body as {
      zone_id?: string
      label?: string
      capacity?: number
      pos_x?: number | null
      pos_y?: number | null
      status?: string
    }

    if (!body?.zone_id || !body?.label?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'zone_id and label are required',
        400,
      )
    }

    const table = createTableEntry(app.hubDb, app.hubConfig.location_id, {
      zoneId: body.zone_id,
      label: body.label.trim(),
      ...pickDefined({
        capacity: body.capacity,
        posX: body.pos_x,
        posY: body.pos_y,
        status: body.status ? parseTableStatus(body.status) : undefined,
      }),
    })

    return reply.status(201).send({ table })
  })

  app.patch('/tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      zone_id?: string
      label?: string
      capacity?: number
      pos_x?: number | null
      pos_y?: number | null
      status?: string
    }

    const table = updateTableEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        zoneId: body?.zone_id,
        label: trimOptionalNonEmpty('label', body?.label),
        capacity: body?.capacity,
        posX: body?.pos_x,
        posY: body?.pos_y,
        status: body?.status ? parseTableStatus(body.status) : undefined,
      }),
    )

    if (!table) {
      throw new AppError('NOT_FOUND', 'Table not found', 404, { id })
    }

    return reply.send({ table })
  })
}
