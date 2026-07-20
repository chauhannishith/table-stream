import { describe, expect, it } from 'vitest'
import { leaseKey, leaseMetaKey } from './redis-keys.js'

describe('redis lease keys', () => {
  it('builds lease and meta keys per PLANNING §2.3', () => {
    expect(leaseKey('loc_1', 'table', 'tbl_9')).toBe(
      'ts:lease:loc_1:table:tbl_9',
    )
    expect(leaseMetaKey('loc_1', 'tok_abc')).toBe(
      'ts:lease:loc_1:meta:tok_abc',
    )
  })
})
