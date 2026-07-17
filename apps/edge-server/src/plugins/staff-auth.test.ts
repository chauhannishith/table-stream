import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { hashPin } from '../lib/auth.js'
import { clearStaffSessions, createStaffSession } from '../lib/staff-sessions.js'
import { createStaff } from '../repositories/staff.js'
import { createCategory } from '../services/menu-catalog.js'
import {
  isStaffAuthExempt,
} from '../plugins/staff-auth.js'

describe('staff permission guard', () => {
  it('exempts staff login from setup permission checks', () => {
    expect(isStaffAuthExempt('/v1/auth/staff/login')).toBe(true)
    expect(isStaffAuthExempt('/v1/menu/items')).toBe(false)
  })

  it('returns 401 when staff token is missing on setup writes', async () => {
    clearStaffSessions()
    const app = await createTestApp()
    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Mains',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      headers: { 'x-staff-token': '' },
      payload: {
        category_id: category.id,
        name: 'Burger',
        base_price_cents: 500,
      },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
    expect(res.json().error.message).toMatch(/Missing staff token/)

    await app.close()
  })

  it('returns 403 when a waiter posts menu items', async () => {
    clearStaffSessions()
    const app = await createTestApp()
    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Mains',
    })

    const waiter = createStaff(app.hubDb, app.hubConfig.location_id, {
      name: 'Waiter',
      role: 'WAITER',
      pinHash: hashPin('1234'),
    })
    const { token: waiterToken } = createStaffSession({
      locationId: app.hubConfig.location_id,
      staffId: waiter.id,
      role: waiter.role,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      headers: { 'x-staff-token': waiterToken },
      payload: {
        category_id: category.id,
        name: 'Burger',
        base_price_cents: 500,
      },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
    expect(res.json().error.details.permission).toBe('setup.manage')

    await app.close()
  })

  it('allows admin to post menu items', async () => {
    const app = await createTestApp()
    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Mains',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      payload: {
        category_id: category.id,
        name: 'Burger',
        base_price_cents: 500,
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().item.name).toBe('Burger')

    await app.close()
  })

  it('allows GET menu without a staff token', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/menu/items',
      headers: { 'x-staff-token': '' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().items).toEqual([])

    await app.close()
  })
})
