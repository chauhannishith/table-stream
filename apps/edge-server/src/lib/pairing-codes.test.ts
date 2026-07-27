import { describe, expect, it } from 'vitest'
import {
  clearPairingCodes,
  consumePairingCode,
  registerPairingCode,
} from '../lib/pairing-codes.js'

describe('registerPairingCode', () => {
  it('registers a dev code for pairing', () => {
    clearPairingCodes()
    registerPairingCode('loc_test', '123456')
    expect(consumePairingCode('loc_test', '123456')).toBe(true)
    expect(consumePairingCode('loc_test', '123456')).toBe(false)
  })
})
