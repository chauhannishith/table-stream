import { describe, expect, it } from 'vitest'
import { organizations } from '@table-stream/shared-types/hub'
import { createTestHubDb } from '../test/fixtures.js'
import {
  getOrganizationById,
  upsertOrganization,
} from './organizations.js'

describe('organizations repository', () => {
  it('upserts idempotently by id', () => {
    const db = createTestHubDb()

    upsertOrganization(db, { id: 'org_1', name: 'First' })
    upsertOrganization(db, { id: 'org_1', name: 'Updated' })

    const rows = db.select().from(organizations).all()
    expect(rows).toHaveLength(1)
    expect(getOrganizationById(db, 'org_1')?.name).toBe('Updated')
  })
})
