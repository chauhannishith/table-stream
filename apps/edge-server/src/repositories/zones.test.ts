import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createHubDbFromSqlite } from '../db/client.js'
import { applyMigrationsToSqlite } from '../db/migrate.js'
import { createZone, getZoneById } from './zones.js'
import { seedHubFromConfig } from '../services/hub-seed.js'
import { testHubConfig } from '../test/fixtures.js'

describe('zones.tax_rules_json (E11.1)', () => {
  it('migration adds tax_rules_json defaulting to empty object', () => {
    const sqlite = new Database(':memory:')
    applyMigrationsToSqlite(sqlite)

    const columns = sqlite
      .prepare(`PRAGMA table_info(zones)`)
      .all() as Array<{ name: string }>
    expect(columns.some((c) => c.name === 'tax_rules_json')).toBe(true)

    const db = createHubDbFromSqlite(sqlite)
    seedHubFromConfig(db, testHubConfig)

    const zone = createZone(db, testHubConfig.location_id, { name: 'Patio' })
    expect(zone.taxRulesJson).toBe('{}')

    const reloaded = getZoneById(db, testHubConfig.location_id, zone.id)
    expect(reloaded?.taxRulesJson).toBe('{}')
  })
})
