import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createZoneEntry,
  listZonesForLocation,
  updateZoneEntry,
} from '../services/floor-setup.js'

export const zoneRoutes: FastifyPluginAsync = async (app) => {
  app.get('/zones', async (request) => {
    const query = request.query as { include_inactive?: string }

    return {
      zones: listZonesForLocation(app.hubDb, app.hubConfig.location_id, {
        includeInactive: query.include_inactive === 'true',
      }),
    }
  })

  app.post('/zones', async (request, reply) => {
    const body = request.body as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    if (!body?.name?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'name is required', 400)
    }

    const zone = createZoneEntry(app.hubDb, app.hubConfig.location_id, {
      name: body.name.trim(),
      ...pickDefined({
        sortOrder: body.sort_order,
        isActive: body.is_active,
      }),
    })

    return reply.status(201).send({ zone })
  })

  app.patch('/zones/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    const zone = updateZoneEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        name: trimOptionalNonEmpty('name', body?.name),
        sortOrder: body?.sort_order,
        isActive: body?.is_active,
      }),
    )

    if (!zone) {
      throw new AppError('NOT_FOUND', 'Zone not found', 404, { id })
    }

    return reply.send({ zone })
  })
}
