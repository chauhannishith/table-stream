import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createKdsStationEntry,
  listKdsStationsForLocation,
  updateKdsStationEntry,
} from '../services/floor-setup.js'

export const kdsStationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/kds-stations', async (request) => {
    const query = request.query as { include_inactive?: string }

    return {
      kds_stations: listKdsStationsForLocation(
        app.hubDb,
        app.hubConfig.location_id,
        { includeInactive: query.include_inactive === 'true' },
      ),
    }
  })

  app.post('/kds-stations', async (request, reply) => {
    const body = request.body as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    if (!body?.name?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'name is required', 400)
    }

    const station = createKdsStationEntry(
      app.hubDb,
      app.hubConfig.location_id,
      {
        name: body.name.trim(),
        ...pickDefined({
          sortOrder: body.sort_order,
          isActive: body.is_active,
        }),
      },
    )

    return reply.status(201).send({ kds_station: station })
  })

  app.patch('/kds-stations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    const station = updateKdsStationEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        name: trimOptionalNonEmpty('name', body?.name),
        sortOrder: body?.sort_order,
        isActive: body?.is_active,
      }),
    )

    if (!station) {
      throw new AppError('NOT_FOUND', 'KDS station not found', 404, { id })
    }

    return reply.send({ kds_station: station })
  })
}
