import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { getInvoiceEntry } from '../services/order-invoices.js'

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/invoices/:id', async (request) => {
    const { id } = request.params as { id: string }

    const invoice = getInvoiceEntry(app.hubDb, app.hubConfig.location_id, id)
    if (!invoice) {
      throw new AppError('NOT_FOUND', 'Invoice not found', 404, { invoice_id: id })
    }

    return { invoice }
  })
}
