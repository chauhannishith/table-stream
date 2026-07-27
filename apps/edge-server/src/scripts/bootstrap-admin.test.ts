import { describe, expect, it } from 'vitest'
import { createTestHubDb, testHubConfig } from '../test/fixtures.js'
import { seedHubFromConfig } from '../services/hub-seed.js'
import { listStaff } from '../repositories/staff.js'
import { bootstrapDevAdminForLocation } from './bootstrap-admin.js'

describe('bootstrapDevAdminForLocation', () => {
  it('creates an ADMIN with default PIN and is idempotent', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    const first = bootstrapDevAdminForLocation(db, testHubConfig.location_id, {
      name: 'Dev Admin',
      pin: '123456',
    })
    expect(first.created).toBe(true)
    expect(first.pin).toBe('123456')

    const staff = listStaff(db, testHubConfig.location_id)
    expect(staff).toHaveLength(1)
    expect(staff[0]?.role).toBe('ADMIN')

    const second = bootstrapDevAdminForLocation(db, testHubConfig.location_id, {
      name: 'Dev Admin',
      pin: '654321',
    })
    expect(second.created).toBe(false)
    expect(second.pin).toBe('654321')
    expect(listStaff(db, testHubConfig.location_id)).toHaveLength(1)
  })

  it('requires a 6-digit pairing code', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    expect(() =>
      bootstrapDevAdminForLocation(db, testHubConfig.location_id, {}),
    ).toThrow(/6 digits/)
  })
})
