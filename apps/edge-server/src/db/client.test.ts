import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHubDb } from './client.js'
import { testHubConfig } from '../test/fixtures.js'
import { seedHubFromConfig, getHubIdentity } from '../services/hub-seed.js'
import { getLatestSchemaVersion } from '../lib/schema-version.js'

describe('createHubDb', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('applies migrations before seed can insert org/location', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'tablestream-hub-'))
    dirs.push(dataDir)

    const db = createHubDb({
      ...testHubConfig,
      data_dir: dataDir,
    })

    expect(getLatestSchemaVersion(db)).toBe('0004_zone_tax_rules.sql')

    seedHubFromConfig(db, {
      ...testHubConfig,
      data_dir: dataDir,
    })

    const identity = getHubIdentity(db, {
      ...testHubConfig,
      data_dir: dataDir,
    })
    expect(identity?.location_name).toBe('Test Location')
  })
})
