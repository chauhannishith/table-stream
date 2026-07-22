import { describe, expect, it } from 'vitest'
import { createTestHubDb } from '../test/fixtures.js'
import { getLatestSchemaVersion } from './schema-version.js'

describe('getLatestSchemaVersion', () => {
  it('returns the latest applied migration id', () => {
    const db = createTestHubDb()
    expect(getLatestSchemaVersion(db)).toBe('0004_zone_tax_rules.sql')
  })
})
