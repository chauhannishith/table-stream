import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { getStaffById } from '../repositories/staff.js'

describe('staff routes', () => {
  it('POST /v1/staff stores pin hash and omits it from response', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/staff',
      payload: { name: 'Alex', role: 'WAITER', pin: '1234' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json().staff
    expect(body.name).toBe('Alex')
    expect(body.role).toBe('WAITER')
    expect(body).not.toHaveProperty('pin')
    expect(body).not.toHaveProperty('pin_hash')

    const row = getStaffById(
      app.hubDb,
      app.hubConfig.location_id,
      body.id,
    )
    expect(row?.pinHash).toMatch(/^scrypt:/)

    await app.close()
  })

  it('GET /v1/staff lists active staff only by default', async () => {
    const app = await createTestApp()

    const created = await app.inject({
      method: 'POST',
      url: '/v1/staff',
      payload: { name: 'Sam', role: 'ADMIN', pin: '9999' },
    })
    const staffId = created.json().staff.id

    await app.inject({
      method: 'PATCH',
      url: `/v1/staff/${staffId}`,
      payload: { is_active: false },
    })

    const list = await app.inject({ method: 'GET', url: '/v1/staff' })
    expect(list.json().staff.map((s: { name: string }) => s.name)).toEqual([
      'Test Admin',
    ])

    const all = await app.inject({
      method: 'GET',
      url: '/v1/staff?include_inactive=true',
    })
    expect(all.json().staff).toHaveLength(2)

    await app.close()
  })
})
