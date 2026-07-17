import { describe, expect, it } from 'vitest'
import {
  createTestHubDb,
  seedMinimalLocation,
  testHubConfig,
} from '../test/fixtures.js'
import { nextTokenNumber } from '../repositories/token-counters.js'

describe('token counters', () => {
  it('increments daily takeaway tokens', () => {
    const db = createTestHubDb()
    seedMinimalLocation(db)
    const locationId = testHubConfig.location_id

    expect(nextTokenNumber(db, locationId, 'TAKEAWAY', '2026-07-16')).toBe(
      'T-001',
    )
    expect(nextTokenNumber(db, locationId, 'TAKEAWAY', '2026-07-16')).toBe(
      'T-002',
    )
    expect(nextTokenNumber(db, locationId, 'TAKEAWAY', '2026-07-17')).toBe(
      'T-001',
    )
  })
})
