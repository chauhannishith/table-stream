import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  getBillingConfig,
  parsePriceTaxMode,
  setBillingConfig,
} from '../services/floor-setup.js'

export const locationBillingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/location/billing-config', async () => {
    return {
      billing_config: getBillingConfig(
        app.hubDb,
        app.hubConfig.location_id,
      ),
    }
  })

  app.put('/location/billing-config', async (request, reply) => {
    const body = request.body as {
      tax_rules?: Record<string, unknown>
      price_tax_mode?: string
      service_charge_rules?: Record<string, unknown>
      tip_quick_actions?: unknown[]
    }

    if (
      body?.price_tax_mode !== undefined &&
      body.price_tax_mode !== 'INCLUSIVE' &&
      body.price_tax_mode !== 'EXCLUSIVE'
    ) {
      throw new AppError('VALIDATION_ERROR', 'Invalid price_tax_mode', 400)
    }

    const billingConfig = setBillingConfig(
      app.hubDb,
      app.hubConfig.location_id,
      pickDefined({
        taxRules: body?.tax_rules,
        priceTaxMode: body?.price_tax_mode
          ? parsePriceTaxMode(body.price_tax_mode)
          : undefined,
        serviceChargeRules: body?.service_charge_rules,
        tipQuickActions: body?.tip_quick_actions,
      }),
    )

    return reply.send({ billing_config: billingConfig })
  })
}
