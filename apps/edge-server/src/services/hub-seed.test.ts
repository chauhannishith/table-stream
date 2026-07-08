import { describe, expect, it } from 'vitest'
import { organizations, locations } from '@table-stream/shared-types/hub'
import { testHubConfig, createTestHubDb } from '../test/fixtures.js'
import { getHubIdentity, seedHubFromConfig } from './hub-seed.js'

describe('seedHubFromConfig', () => {
  it('is idempotent — two runs leave one org and one location', () => {
    const db = createTestHubDb()

    seedHubFromConfig(db, testHubConfig)
    seedHubFromConfig(db, testHubConfig)

    expect(db.select().from(organizations).all()).toHaveLength(1)
    expect(db.select().from(locations).all()).toHaveLength(1)

    const identity = getHubIdentity(db, testHubConfig)
    expect(identity).toEqual({
      org_id: 'org_test',
      location_id: 'loc_test',
      hub_id: 'hub_test',
      location_name: 'Test Location',
      timezone: 'UTC',
      hub_status: 'ACTIVE',
      cloud_sync_enabled: false,
    })
  })

  it('updates location_name when config changes', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)
    seedHubFromConfig(db, {
      ...testHubConfig,
      location_name: 'Renamed Location',
    })

    const identity = getHubIdentity(db, testHubConfig)
    expect(identity?.location_name).toBe('Renamed Location')
  })
})
