import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createZoneEntry } from '../services/floor-setup.js'

describe('zones routes', () => {
  it('GET /v1/zones returns an empty list initially', async () => {
    const app = await createTestApp()

    const res = await app.inject({ method: 'GET', url: '/v1/zones' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ zones: [] })

    await app.close()
  })

  it('POST /v1/zones creates a zone', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones',
      payload: { name: 'Patio', sort_order: 1 },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().zone.name).toBe('Patio')
    expect(res.json().zone.sort_order).toBe(1)
    expect(res.json().zone.tax_rules).toEqual({})

    await app.close()
  })

  it('POST /v1/zones accepts tax_rules component map', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones',
      payload: {
        name: 'AC Indoor',
        tax_rules: { cgst: 2.5, sgst: 2.5 },
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().zone.tax_rules).toEqual({ cgst: 2.5, sgst: 2.5 })

    const list = await app.inject({ method: 'GET', url: '/v1/zones' })
    expect(list.json().zones[0].tax_rules).toEqual({ cgst: 2.5, sgst: 2.5 })

    await app.close()
  })

  it('POST /v1/zones rejects invalid tax_rules', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones',
      payload: {
        name: 'Bad Tax',
        tax_rules: { gst: 'eighteen' },
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')

    await app.close()
  })

  it('PATCH /v1/zones/:id updates tax_rules', async () => {
    const app = await createTestApp()
    const zone = createZoneEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Outdoor',
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/zones/${zone.id}`,
      payload: { tax_rules: { gst: 18 } },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().zone.tax_rules).toEqual({ gst: 18 })

    await app.close()
  })

  it('PATCH /v1/zones/:id deactivates a zone', async () => {
    const app = await createTestApp()
    const zone = createZoneEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Bar',
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/zones/${zone.id}`,
      payload: { is_active: false },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().zone.is_active).toBe(false)

    const list = await app.inject({ method: 'GET', url: '/v1/zones' })
    expect(list.json().zones).toHaveLength(0)

    await app.close()
  })
})
