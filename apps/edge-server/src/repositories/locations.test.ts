import { describe, expect, it } from 'vitest'
import { locations } from '@table-stream/shared-types/hub'
import { createTestHubDb } from '../test/fixtures.js'
import { upsertOrganization } from './organizations.js'
import { getLocationById, upsertLocation } from './locations.js'

describe('locations repository', () => {
  it('upserts idempotently by id', () => {
    const db = createTestHubDb()
    upsertOrganization(db, { id: 'org_1', name: 'Org' })

    upsertLocation(db, {
      id: 'loc_1',
      orgId: 'org_1',
      name: 'First',
      timezone: 'UTC',
      hubId: 'hub_1',
      cloudSyncEnabled: false,
    })
    upsertLocation(db, {
      id: 'loc_1',
      orgId: 'org_1',
      name: 'Updated',
      timezone: 'Asia/Kolkata',
      hubId: 'hub_1',
      cloudSyncEnabled: true,
    })

    const rows = db.select().from(locations).all()
    expect(rows).toHaveLength(1)

    const row = getLocationById(db, 'loc_1')
    expect(row?.name).toBe('Updated')
    expect(row?.timezone).toBe('Asia/Kolkata')
    expect(row?.cloudSyncEnabled).toBe(true)
  })
})
