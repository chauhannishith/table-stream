import { describe, expect, it } from 'vitest'
import {
  hashDeviceToken,
  hashPin,
  issueDeviceToken,
  verifyPin,
} from './auth.js'

describe('hashPin', () => {
  it('returns a scrypt hash string', () => {
    const hashed = hashPin('1234')
    expect(hashed).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/)
  })

  it('produces different hashes for the same pin', () => {
    expect(hashPin('1234')).not.toBe(hashPin('1234'))
  })

  it('verifies a pin against its hash', () => {
    const hashed = hashPin('5678')
    expect(verifyPin('5678', hashed)).toBe(true)
    expect(verifyPin('0000', hashed)).toBe(false)
  })
})

describe('device token secrets', () => {
  it('issues deterministic hashes for device tokens', () => {
    const token = issueDeviceToken()
    expect(hashDeviceToken(token)).toBe(hashDeviceToken(token))
    expect(hashDeviceToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashDeviceToken(token)).not.toBe(hashDeviceToken('other'))
  })
})
