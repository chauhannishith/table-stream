import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  enqueuePrintJob,
  parsePrintJobStatus,
  parsePrintStage,
  updatePrintJobStatus,
} from '../services/print-jobs.js'

/** Local print queue endpoints for kitchen, invoice, and collection jobs. */
export const printJobRoutes: FastifyPluginAsync = async (app) => {
  app.post('/print-jobs', async (request, reply) => {
    const body = request.body as {
      order_id?: string
      stage?: string
      printer_id?: string | null
      submit_batch?: number | null
    }

    if (!body?.order_id) {
      throw new AppError('VALIDATION_ERROR', 'order_id is required', 400)
    }
    if (!body?.stage) {
      throw new AppError('VALIDATION_ERROR', 'stage is required', 400)
    }

    const job = enqueuePrintJob(app.hubDb, app.hubConfig.location_id, {
      orderId: body.order_id,
      stage: parsePrintStage(body.stage),
      ...pickDefined({
        printerId: body.printer_id,
        submitBatch: body.submit_batch,
      }),
    })

    return reply.status(201).send({ print_job: job })
  })

  app.patch('/print-jobs/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { status?: string }

    if (!body?.status) {
      throw new AppError('VALIDATION_ERROR', 'status is required', 400)
    }

    const job = updatePrintJobStatus(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      parsePrintJobStatus(body.status),
    )

    return reply.send({ print_job: job })
  })
}
