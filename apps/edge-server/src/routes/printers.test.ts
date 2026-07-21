import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'

describe('printers routes', () => {
  it('GET /v1/printers returns empty list initially', async () => {
    const app = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/v1/printers' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ printers: [] })
    await app.close()
  })

  it('POST /v1/printers creates a kitchen printer', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/printers',
      payload: {
        name: 'Kitchen grill',
        role: 'KITCHEN',
        connection: { host: '192.168.1.50', port: 9100 },
        kds_station_ids: ['kds_abc123'],
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().printer).toEqual(
      expect.objectContaining({
        name: 'Kitchen grill',
        role: 'KITCHEN',
        connection: { host: '192.168.1.50', port: 9100 },
        kds_station_ids: ['kds_abc123'],
        is_active: true,
      }),
    )

    const list = await app.inject({ method: 'GET', url: '/v1/printers' })
    expect(list.json().printers).toHaveLength(1)

    await app.close()
  })

  it('POST /v1/printers rejects invalid role', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/printers',
      payload: { name: 'Bad printer', role: 'RECEIPT' },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('PATCH /v1/printers/:id updates printer fields', async () => {
    const app = await createTestApp()

    const created = await app.inject({
      method: 'POST',
      url: '/v1/printers',
      payload: { name: 'Counter', role: 'ORDERING' },
    })
    const id = created.json().printer.id

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/printers/${id}`,
      payload: {
        name: 'Front counter',
        is_active: false,
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().printer).toEqual(
      expect.objectContaining({
        name: 'Front counter',
        is_active: false,
      }),
    )

    const list = await app.inject({ method: 'GET', url: '/v1/printers' })
    expect(list.json().printers).toHaveLength(0)

    const inactive = await app.inject({
      method: 'GET',
      url: '/v1/printers?include_inactive=true',
    })
    expect(inactive.json().printers).toHaveLength(1)

    await app.close()
  })

  it('PATCH /v1/printers/:id returns 404 for unknown printer', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/printers/prn_missing',
      payload: { name: 'Ghost' },
    })

    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
