import { describe, expect, it } from 'vitest'
import {
  createTestHubDb,
  seedMinimalLocation,
  testHubConfig,
} from '../test/fixtures.js'
import { createCategory } from './menu-catalog.js'
import { createMenuItem } from '../repositories/menu-items.js'
import { createZone } from '../repositories/zones.js'
import { upsertMenuItemZonePrices } from '../repositories/menu-item-zone-prices.js'
import { resolveUnitPriceCents } from './pricing.js'

describe('resolveUnitPriceCents', () => {
  it('falls back to base_price_cents when no zone price exists', () => {
    const db = createTestHubDb()
    seedMinimalLocation(db)
    const locationId = testHubConfig.location_id

    const category = createCategory(db, locationId, { name: 'Mains' })
    const item = createMenuItem(db, locationId, {
      categoryId: category.id,
      name: 'Burger',
      basePriceCents: 500,
    })

    expect(resolveUnitPriceCents(db, item.id)).toBe(500)
  })

  it('uses zone price when configured', () => {
    const db = createTestHubDb()
    seedMinimalLocation(db)
    const locationId = testHubConfig.location_id

    const category = createCategory(db, locationId, { name: 'Mains' })
    const item = createMenuItem(db, locationId, {
      categoryId: category.id,
      name: 'Burger',
      basePriceCents: 500,
    })
    const zoneId = createZone(db, locationId, { name: 'Patio' }).id
    upsertMenuItemZonePrices(db, item.id, [{ zoneId, priceCents: 650 }])

    expect(resolveUnitPriceCents(db, item.id, zoneId)).toBe(650)
    expect(resolveUnitPriceCents(db, item.id)).toBe(500)
  })
})
