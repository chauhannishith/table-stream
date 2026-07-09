import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'

describe('kds stations routes', () => {
  it('POST /v1/kds-stations creates a station', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/kds-stations',
      payload: { name: 'Grill', sort_order: 0 },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().kds_station.name).toBe('Grill')

    const list = await app.inject({ method: 'GET', url: '/v1/kds-stations' })
    expect(list.json().kds_stations).toHaveLength(1)

    await app.close()
  })
})
