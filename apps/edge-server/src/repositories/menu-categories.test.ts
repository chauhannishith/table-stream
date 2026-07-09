import { describe, expect, it } from 'vitest'
import {
  createTestHubDb,
  seedMinimalLocation,
  testHubConfig,
} from '../test/fixtures.js'
import {
  createMenuCategory,
  listMenuCategories,
} from './menu-categories.js'

describe('menu-categories repository', () => {
  it('lists categories for a location ordered by sort_order', () => {
    const db = createTestHubDb()
    seedMinimalLocation(db)
    const locationId = testHubConfig.location_id

    createMenuCategory(db, locationId, { name: 'Desserts', sortOrder: 2 })
    createMenuCategory(db, locationId, { name: 'Mains', sortOrder: 1 })

    expect(listMenuCategories(db, locationId).map((row) => row.name)).toEqual([
      'Mains',
      'Desserts',
    ])
  })

  it('hides inactive categories by default', () => {
    const db = createTestHubDb()
    seedMinimalLocation(db)
    const locationId = testHubConfig.location_id

    createMenuCategory(db, locationId, { name: 'Active', isActive: true })
    createMenuCategory(db, locationId, { name: 'Hidden', isActive: false })

    expect(listMenuCategories(db, locationId)).toHaveLength(1)
    expect(
      listMenuCategories(db, locationId, { includeInactive: true }),
    ).toHaveLength(2)
  })
})
