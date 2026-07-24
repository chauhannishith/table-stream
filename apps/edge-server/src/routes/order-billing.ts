import type { FastifyPluginAsync } from 'fastify'
import { DiscountType, TenderType } from '@table-stream/shared-types/domain'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { previewOrderBill, finalizeOrderBill } from '../services/order-billing.js'
import { recordOrderPayment } from '../services/order-payments.js'
import { issueOrderInvoice } from '../services/order-invoices.js'

function parseDiscountType(value: string | undefined): DiscountType | undefined {
  if (!value) return undefined
  const parsed = DiscountType.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid discount_type', 400, {
      discount_type: value,
    })
  }
  return parsed.data
}

function parseTenderType(value: string | undefined): TenderType {
  if (!value) {
    throw new AppError('VALIDATION_ERROR', 'tender_type is required', 400)
  }
  const parsed = TenderType.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid tender_type', 400, {
      tender_type: value,
    })
  }
  return parsed.data
}

export const orderBillingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/orders/:id/bill/preview', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      discount_type?: string
      discount_value?: number
      tip_cents?: number
    }

    const preview = previewOrderBill(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        discountType: parseDiscountType(body?.discount_type),
        discountValue: body?.discount_value,
        tipCents: body?.tip_cents,
      }),
    )

    return { preview }
  })

  app.post('/orders/:id/bill', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      discount_type?: string
      discount_value?: number
      tip_cents?: number
    }

    const order = finalizeOrderBill(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        discountType: parseDiscountType(body?.discount_type),
        discountValue: body?.discount_value,
        tipCents: body?.tip_cents,
      }),
    )

    return { order }
  })

  app.post('/orders/:id/payments', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      tender_type?: string
      amount_cents?: number
    }

    const result = recordOrderPayment(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      {
        tenderType: parseTenderType(body?.tender_type),
        ...(body?.amount_cents !== undefined
          ? { amountCents: body.amount_cents }
          : {}),
      },
    )

    return result
  })

  app.post('/orders/:id/invoice', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { cashier_id?: string | null }

    return issueOrderInvoice(
      app.hubDb,
      app.hubConfig,
      app.hubConfig.location_id,
      id,
      {
        ...(body?.cashier_id !== undefined
          ? { cashierId: body.cashier_id }
          : {}),
      },
    )
  })
}
