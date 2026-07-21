import { describe, expect, it } from 'vitest'
import { DEFAULT_PRINT_STAGES } from '../services/print-config.js'
import { createTestApp } from '../test/fixtures.js'

describe('location print config routes', () => {
  it('GET /v1/location/print-config returns stage defaults', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/location/print-config',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().print_config).toEqual({
      location_id: app.hubConfig.location_id,
      print_stages: DEFAULT_PRINT_STAGES,
      updated_at: null,
    })

    await app.close()
  })

  it('PUT /v1/location/print-config upserts stage toggles', async () => {
    const app = await createTestApp()

    const nextStages = {
      ordering: { enabled: false, auto_on_bill: false },
      kitchen: {
        enabled: true,
        auto_on_submit: false,
        split_by_station: true,
        split_by_token: false,
      },
      collection: {
        enabled: true,
        auto_print_dine_in: true,
        auto_print_takeaway: false,
        trigger: 'manual_only' as const,
      },
    }

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/location/print-config',
      payload: { print_stages: nextStages },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().print_config.print_stages).toEqual(nextStages)
    expect(res.json().print_config.updated_at).toBeTruthy()

    const get = await app.inject({
      method: 'GET',
      url: '/v1/location/print-config',
    })
    expect(get.json().print_config.print_stages).toEqual(nextStages)

    await app.close()
  })

  it('PUT /v1/location/print-config rejects invalid stage toggles', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/location/print-config',
      payload: {
        print_stages: {
          ordering: { enabled: true, auto_on_bill: true },
        },
      },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
