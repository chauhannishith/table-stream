import { describe, expect, it } from 'vitest'
import {
  createTestHubDb,
  seedMinimalLocation,
  testHubConfig,
} from '../test/fixtures.js'
import { createMenuTag } from './menu-tags.js'
import { AppError } from '../lib/errors.js'

describe('menu-tags repository', () => {
  it('returns 409 on duplicate location code', () => {
    const db = createTestHubDb()
    seedMinimalLocation(db)
    const locationId = testHubConfig.location_id

    createMenuTag(db, locationId, { code: 'vegan', label: 'Vegan' })

    expect(() =>
      createMenuTag(db, locationId, { code: 'vegan', label: 'Vegan again' }),
    ).toThrow(AppError)
  })
})
