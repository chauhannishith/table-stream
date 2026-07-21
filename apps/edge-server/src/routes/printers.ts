import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createPrinterEntry,
  listPrintersForLocation,
  parsePrinterRole,
  updatePrinterEntry,
} from '../services/printers.js'

export const printerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/printers', async (request) => {
    const query = request.query as { include_inactive?: string }

    return {
      printers: listPrintersForLocation(
        app.hubDb,
        app.hubConfig.location_id,
        { includeInactive: query.include_inactive === 'true' },
      ),
    }
  })

  app.post('/printers', async (request, reply) => {
    const body = request.body as {
      name?: string
      role?: string
      connection?: Record<string, unknown>
      kds_station_ids?: string[] | null
      is_active?: boolean
    }

    if (!body?.name?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'name is required', 400)
    }
    if (!body?.role) {
      throw new AppError('VALIDATION_ERROR', 'role is required', 400)
    }

    const printer = createPrinterEntry(app.hubDb, app.hubConfig.location_id, {
      name: body.name.trim(),
      role: parsePrinterRole(body.role),
      ...pickDefined({
        connectionJson: body.connection,
        kdsStationIds: body.kds_station_ids,
        isActive: body.is_active,
      }),
    })

    return reply.status(201).send({ printer })
  })

  app.patch('/printers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      role?: string
      connection?: Record<string, unknown>
      kds_station_ids?: string[] | null
      is_active?: boolean
    }

    const printer = updatePrinterEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        name: trimOptionalNonEmpty('name', body?.name),
        role: body?.role ? parsePrinterRole(body.role) : undefined,
        connectionJson: body?.connection,
        kdsStationIds: body?.kds_station_ids,
        isActive: body?.is_active,
      }),
    )

    if (!printer) {
      throw new AppError('NOT_FOUND', 'Printer not found', 404, { id })
    }

    return reply.send({ printer })
  })
}
