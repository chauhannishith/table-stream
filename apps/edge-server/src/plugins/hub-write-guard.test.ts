import { locations } from '@table-stream/shared-types/hub'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hashPin } from '../lib/auth.js'
import { isHubWriteGuardExempt } from '../plugins/hub-write-guard.js'
import { createStaff } from '../repositories/staff.js'
import { createCategory } from '../services/menu-catalog.js'
import { createTestApp } from '../test/fixtures.js'

function suspendHub(app: Awaited<ReturnType<typeof createTestApp>>) {
  app.hubDb
    .update(locations)
    .set({ hubStatus: 'SUSPENDED' })
    .where(eq(locations.id, app.hubConfig.location_id))
    .run()
}

describe('hub write guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exempts reads and staff login from suspended write block', () => {
    expect(isHubWriteGuardExempt('GET', '/v1/orders')).toBe(true)
    expect(isHubWriteGuardExempt('HEAD', '/v1/menu/items')).toBe(true)
    expect(isHubWriteGuardExempt('OPTIONS', '/v1/orders')).toBe(true)
    expect(isHubWriteGuardExempt('POST', '/v1/auth/staff/login')).toBe(true)
    expect(isHubWriteGuardExempt('POST', '/v1/orders')).toBe(false)
    expect(isHubWriteGuardExempt('PATCH', '/v1/menu/items/x')).toBe(false)
    expect(isHubWriteGuardExempt('POST', '/health')).toBe(false)
  })

  it('allows GET when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    createCategory(app.hubDb, app.hubConfig.location_id, { name: 'Mains' })
    suspendHub(app)

    const res = await app.inject({ method: 'GET', url: '/v1/menu/categories' })

    expect(res.statusCode).toBe(200)
    expect(res.json().categories).toHaveLength(1)

    await app.close()
  })

  it('returns 403 for POST when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    suspendHub(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/categories',
      payload: { name: 'Blocked' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
    expect(res.json().error.message).toBe('Hub is suspended')
    expect(res.json().error.details.hub_status).toBe('SUSPENDED')

    await app.close()
  })

  it('returns 403 for POST when HUB_ENTITLED is false', async () => {
    vi.stubEnv('HUB_ENTITLED', 'false')
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/categories',
      payload: { name: 'Blocked' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.details.hub_status).toBe('SUSPENDED')

    await app.close()
  })

  it('allows POST /v1/auth/staff/login when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    const staff = createStaff(app.hubDb, app.hubConfig.location_id, {
      name: 'Archive Admin',
      role: 'ADMIN',
      pinHash: hashPin('9999'),
    })
    suspendHub(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/staff/login',
      headers: { 'x-staff-token': '' },
      payload: { staff_id: staff.id, pin: '9999' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().session_token).toBeTruthy()

    await app.close()
  })

  it('returns 403 before device auth when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    suspendHub(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: { 'x-device-token': '' },
      payload: { order_type: 'TAKEAWAY' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')

    await app.close()
  })
})
