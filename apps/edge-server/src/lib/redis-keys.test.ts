import { describe, expect, it } from 'vitest'
import {
  kdsItemKey,
  kdsQueueKey,
  leaseKey,
  leaseMetaKey,
  streamEventsKey,
} from './redis-keys.js'

describe('redis lease keys', () => {
  it('builds lease and meta keys per PLANNING §2.3', () => {
    expect(leaseKey('loc_1', 'table', 'tbl_9')).toBe(
      'ts:lease:loc_1:table:tbl_9',
    )
    expect(leaseMetaKey('loc_1', 'tok_abc')).toBe(
      'ts:lease:loc_1:meta:tok_abc',
    )
  })

  it('builds KDS queue and item keys per PLANNING §2.4', () => {
    expect(kdsQueueKey('station_1')).toBe('ts:kds:station_1:queue')
    expect(kdsItemKey('station_1', 'line_9')).toBe(
      'ts:kds:station_1:item:line_9',
    )
  })

  it('builds hub event stream key per PLANNING §2.6', () => {
    expect(streamEventsKey()).toBe('ts:stream:events')
  })
})
