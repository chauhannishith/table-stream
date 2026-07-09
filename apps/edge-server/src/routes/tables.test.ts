import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createZoneEntry } from '../services/floor-setup.js'

describe('tables routes', () => {
  it('POST /v1/tables creates a table in a zone', async () => {
    const app = await createTestApp()
    const zone = createZoneEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Main',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tables',
      payload: {
        zone_id: zone.id,
        label: 'T1',
        capacity: 4,
        pos_x: 10,
        pos_y: 20,
      },
    })

    expect(res.statusCode).toBe(201)
    const table = res.json().table
    expect(table.label).toBe('T1')
    expect(table.zone_id).toBe(zone.id)
    expect(table.status).toBe('AVAILABLE')

    await app.close()
  })

  it('POST /v1/tables returns 404 for unknown zone', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tables',
      payload: { zone_id: 'zone_missing', label: 'T1' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })

  it('PATCH /v1/tables/:id updates status', async () => {
    const app = await createTestApp()
    const zone = createZoneEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Main',
    })

    const created = await app.inject({
      method: 'POST',
      url: '/v1/tables',
      payload: { zone_id: zone.id, label: 'T2' },
    })
    const tableId = created.json().table.id

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/tables/${tableId}`,
      payload: { status: 'OCCUPIED' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().table.status).toBe('OCCUPIED')
    expect(res.json().table.version).toBe(2)

    await app.close()
  })
})
