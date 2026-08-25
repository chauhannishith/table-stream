import { http, HttpResponse } from 'msw'
import {
  getBillingConfig,
  nowIso,
  parseTaxRules,
  setBillingConfig,
} from './stores'

export const sessionHandlers = [
  http.get('*/v1/status', () =>
    HttpResponse.json({
      hub_status: 'ACTIVE',
      location_name: 'Test Location',
      schema_version: '0005_order_bill_tax_snapshot.sql',
      db_ready: true,
      cloud_sync_enabled: false,
      org_id: 'org_test',
      location_id: 'loc_test',
      hub_id: 'hub_test',
      subscription_status: 'ACTIVE',
    }),
  ),

  http.get('*/v1/location/billing-config', () =>
    HttpResponse.json({ billing_config: getBillingConfig() }),
  ),

  http.put('*/v1/location/billing-config', async ({ request }) => {
    const body = (await request.json()) as {
      tax_rules?: unknown
      price_tax_mode?: string
      service_charge_rules?: Record<string, unknown>
      tip_quick_actions?: number[]
    }

    const parsedTaxRules =
      body.tax_rules === undefined
        ? { ok: true as const, rules: getBillingConfig().tax_rules }
        : parseTaxRules(body.tax_rules)
    if (!parsedTaxRules.ok) return parsedTaxRules.response

    if (
      body.price_tax_mode !== undefined &&
      body.price_tax_mode !== 'INCLUSIVE' &&
      body.price_tax_mode !== 'EXCLUSIVE'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid price_tax_mode',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const nextBilling = {
      ...getBillingConfig(),
      tax_rules: parsedTaxRules.rules,
      price_tax_mode:
        body.price_tax_mode ?? getBillingConfig().price_tax_mode,
      service_charge_rules:
        body.service_charge_rules ?? getBillingConfig().service_charge_rules,
      tip_quick_actions:
        body.tip_quick_actions ?? getBillingConfig().tip_quick_actions,
      updated_at: nowIso(),
    }
    setBillingConfig(nextBilling)
    return HttpResponse.json({ billing_config: nextBilling })
  }),

  http.post('*/v1/devices/pair', async ({ request }) => {
    const body = (await request.json()) as {
      pairing_code?: string
      device_type?: string
      name?: string
    }

    if (body.pairing_code !== '123456') {
      return HttpResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired pairing code',
            details: {},
          },
        },
        { status: 401 },
      )
    }

    return HttpResponse.json({
      device: {
        id: 'dev_test',
        location_id: 'loc_test',
        device_type: body.device_type ?? 'COUNTER',
        name: body.name ?? 'Test device',
        is_active: true,
      },
      device_token: 'tok_test',
    })
  }),
]
