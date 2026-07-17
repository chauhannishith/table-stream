import { describe, expect, it, beforeEach } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { clearAllStaffLockouts, STAFF_MAX_PIN_FAILURES } from '../lib/staff-lockout.js'
import { clearStaffSessions, getStaffSessionByToken } from '../lib/staff-sessions.js'

describe('staff auth routes', () => {
  beforeEach(() => {
    clearAllStaffLockouts()
    clearStaffSessions()
  })

  it('POST /v1/auth/staff/login returns a session_token for a valid PIN', async () => {
    const app = await createTestApp()

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/staff',
      payload: {
        name: 'Alex Waiter',
        role: 'WAITER',
        pin: '1234',
      },
    })
    expect(createRes.statusCode).toBe(201)
    const staffId = createRes.json().staff.id

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/staff/login',
      payload: { staff_id: staffId, pin: '1234' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.staff.id).toBe(staffId)
    expect(body.staff.role).toBe('WAITER')
    expect(body).not.toHaveProperty('pin_hash')
    expect(body.session_token).toBeTruthy()
    expect(getStaffSessionByToken(body.session_token)?.staffId).toBe(staffId)

    await app.close()
  })

  it('POST /v1/auth/staff/login returns 401 for invalid PIN', async () => {
    const app = await createTestApp()

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/staff',
      payload: { name: 'Sam', role: 'COUNTER', pin: '4321' },
    })
    const staffId = createRes.json().staff.id

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/staff/login',
      payload: { staff_id: staffId, pin: '9999' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
    expect(res.json().error.details.failures).toBe(1)

    await app.close()
  })

  it('locks out after too many failed PIN attempts', async () => {
    const app = await createTestApp()

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/staff',
      payload: { name: 'Pat', role: 'ADMIN', pin: '1111' },
    })
    const staffId = createRes.json().staff.id

    for (let i = 0; i < STAFF_MAX_PIN_FAILURES - 1; i++) {
      const attempt = await app.inject({
        method: 'POST',
        url: '/v1/auth/staff/login',
        payload: { staff_id: staffId, pin: '0000' },
      })
      expect(attempt.statusCode).toBe(401)
    }

    const locked = await app.inject({
      method: 'POST',
      url: '/v1/auth/staff/login',
      payload: { staff_id: staffId, pin: '0000' },
    })
    expect(locked.statusCode).toBe(403)
    expect(locked.json().error.code).toBe('FORBIDDEN')
    expect(locked.json().error.details.locked_until).toBeTruthy()

    const stillLocked = await app.inject({
      method: 'POST',
      url: '/v1/auth/staff/login',
      payload: { staff_id: staffId, pin: '1111' },
    })
    expect(stillLocked.statusCode).toBe(403)

    await app.close()
  })
})
