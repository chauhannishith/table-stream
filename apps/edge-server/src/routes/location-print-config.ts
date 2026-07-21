import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { getPrintConfig, parsePrintStages, setPrintConfig } from '../services/print-config.js'

/** Admin routes for per-location print stage toggles. */
export const locationPrintConfigRoutes: FastifyPluginAsync = async (app) => {
  app.get('/location/print-config', async () => {
    return {
      print_config: getPrintConfig(app.hubDb, app.hubConfig.location_id),
    }
  })

  app.put('/location/print-config', async (request, reply) => {
    const body = request.body as { print_stages?: unknown }

    if (body?.print_stages === undefined) {
      throw new AppError('VALIDATION_ERROR', 'print_stages is required', 400)
    }

    const printConfig = setPrintConfig(
      app.hubDb,
      app.hubConfig.location_id,
      parsePrintStages(body.print_stages),
    )

    return reply.send({ print_config: printConfig })
  })
}
