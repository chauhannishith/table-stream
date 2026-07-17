import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { hashDeviceToken } from '../lib/auth.js'
import { getDeviceById } from '../repositories/devices.js'

describe('device pairing routes', () => {
  it('POST /v1/devices/pair issues a device_token for a valid pairing code', async () => {
    const app = await createTestApp()

    const codeRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pairing-codes',
    })
    expect(codeRes.statusCode).toBe(200)
    const pairingCode = codeRes.json().pairing_code
    expect(pairingCode).toMatch(/^\d{6}$/)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      payload: {
        pairing_code: pairingCode,
        device_type: 'WAITER',
        name: 'Waiter iPad 1',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.device.device_type).toBe('WAITER')
    expect(body.device.name).toBe('Waiter iPad 1')
    expect(body.device_token).toBeTruthy()
    expect(body).not.toHaveProperty('device_token_hash')

    const row = getDeviceById(app.hubDb, app.hubConfig.location_id, body.device.id)
    expect(row?.deviceTokenHash).toBe(hashDeviceToken(body.device_token))

    await app.close()
  })

  it('POST /v1/devices/pair returns 401 for invalid pairing code', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      payload: {
        pairing_code: '000000',
        device_type: 'KITCHEN',
        name: 'Grill KDS',
      },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')

    await app.close()
  })

  it('pairing codes are single-use', async () => {
    const app = await createTestApp()

    const codeRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pairing-codes',
    })
    const pairingCode = codeRes.json().pairing_code

    const first = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      payload: {
        pairing_code: pairingCode,
        device_type: 'COUNTER',
        name: 'Counter 1',
      },
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      payload: {
        pairing_code: pairingCode,
        device_type: 'COUNTER',
        name: 'Counter 2',
      },
    })
    expect(second.statusCode).toBe(401)

    await app.close()
  })
})
