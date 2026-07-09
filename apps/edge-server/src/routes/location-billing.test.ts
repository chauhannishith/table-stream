import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'

describe('location billing routes', () => {
  it('GET /v1/location/billing-config returns defaults', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/location/billing-config',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().billing_config).toMatchObject({
      location_id: app.hubConfig.location_id,
      price_tax_mode: 'EXCLUSIVE',
      tax_rules: {},
      service_charge_rules: {},
      tip_quick_actions: [],
    })

    await app.close()
  })

  it('PUT /v1/location/billing-config upserts config', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/location/billing-config',
      payload: {
        price_tax_mode: 'INCLUSIVE',
        tax_rules: { gst: { rate_bps: 500 } },
        tip_quick_actions: [10, 15],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().billing_config.price_tax_mode).toBe('INCLUSIVE')
    expect(res.json().billing_config.tax_rules).toEqual({
      gst: { rate_bps: 500 },
    })
    expect(res.json().billing_config.tip_quick_actions).toEqual([10, 15])

    await app.close()
  })
})
