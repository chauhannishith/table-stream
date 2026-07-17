import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { isDeviceAuthExempt } from '../plugins/device-auth.js'

describe('device auth guard', () => {
  it('marks health, status, and pairing paths as exempt', () => {
    expect(isDeviceAuthExempt('/health')).toBe(true)
    expect(isDeviceAuthExempt('/health/ready')).toBe(true)
    expect(isDeviceAuthExempt('/v1/status')).toBe(true)
    expect(isDeviceAuthExempt('/v1/devices/pair')).toBe(true)
    expect(isDeviceAuthExempt('/v1/devices/pairing-codes')).toBe(true)
    expect(isDeviceAuthExempt('/v1/orders')).toBe(false)
    expect(isDeviceAuthExempt('/does-not-exist')).toBe(true)
  })

  it('returns 401 when X-Device-Token is missing on /v1 routes', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/orders',
      headers: { 'x-device-token': '' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
    expect(res.json().error.message).toMatch(/Missing device token/)

    await app.close()
  })

  it('returns 401 when X-Device-Token is invalid', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/orders',
      headers: { 'x-device-token': 'not-a-real-token' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
    expect(res.json().error.message).toMatch(/Invalid device token/)

    await app.close()
  })

  it('allows /v1/status without a device token', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/status',
      headers: { 'x-device-token': '' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().location_id).toBe('loc_test')

    await app.close()
  })

  it('allows pairing without a device token', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/devices/pairing-codes',
      headers: { 'x-device-token': '' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().pairing_code).toMatch(/^\d{6}$/)

    await app.close()
  })
})
