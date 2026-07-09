import { describe, expect, it } from 'vitest'
import { hashPin } from './auth.js'

describe('hashPin', () => {
  it('returns a scrypt hash string', () => {
    const hashed = hashPin('1234')
    expect(hashed).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/)
  })

  it('produces different hashes for the same pin', () => {
    expect(hashPin('1234')).not.toBe(hashPin('1234'))
  })
})
