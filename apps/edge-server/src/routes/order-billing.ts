import type { FastifyPluginAsync } from 'fastify'
import { DiscountType } from '@table-stream/shared-types/domain'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { previewOrderBill } from '../services/order-billing.js'

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
}
