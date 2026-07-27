import { describe, expect, it } from 'vitest'
import { createDevicePairingCode } from '../services/device-pairing.js'
import {
  clearPairingCodes,
  consumePairingCode,
  issuePairingCode,
  registerPairingCode,
} from '../lib/pairing-codes.js'

describe('pairing code TTL', () => {
  it('registerPairingCode applies default TTL when ttlMs is omitted', () => {
    clearPairingCodes()
    const record = registerPairingCode('loc_test', '123456', undefined)
    expect(Number.isFinite(record.expiresAtMs)).toBe(true)
    expect(record.expiresAtMs).toBeGreaterThan(Date.now())
    expect(consumePairingCode('loc_test', '123456')).toBe(true)
  })

  it('issuePairingCode applies default TTL when ttlMs is omitted', () => {
    clearPairingCodes()
    const record = issuePairingCode('loc_test', undefined)
    expect(Number.isFinite(record.expiresAtMs)).toBe(true)
    expect(record.expiresAtMs).toBeGreaterThan(Date.now())
  })

  it('rejects expired codes on consume', () => {
    clearPairingCodes()
    registerPairingCode('loc_test', '123456', -1_000)
    expect(consumePairingCode('loc_test', '123456')).toBe(false)
  })

  it('createDevicePairingCode resolves TTL for custom codes without ttlMs', () => {
    clearPairingCodes()
    const result = createDevicePairingCode('loc_test', { code: '654321' })
    const expiresAtMs = Date.parse(result.expires_at)
    expect(Number.isFinite(expiresAtMs)).toBe(true)
    expect(expiresAtMs).toBeGreaterThan(Date.now())
    expect(consumePairingCode('loc_test', '654321')).toBe(true)
  })
})
