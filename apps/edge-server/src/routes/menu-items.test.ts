import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createCategory } from '../services/menu-catalog.js'
import { createZone } from '../repositories/zones.js'

describe('menu items routes', () => {
  it('GET /v1/menu/items resolves zone price with base fallback', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      payload: {
        category_id: category.id,
        name: 'Burger',
        base_price_cents: 500,
      },
    })
    const item = createRes.json().item
    const zoneId = createZone(app.hubDb, locationId, { name: 'Patio' })

    await app.inject({
      method: 'PUT',
      url: `/v1/menu/items/${item.id}/zone-prices`,
      payload: { prices: [{ zone_id: zoneId, price_cents: 650 }] },
    })

    const withZone = await app.inject({
      method: 'GET',
      url: `/v1/menu/items?zone_id=${zoneId}`,
    })
    expect(withZone.json().items[0].unit_price_cents).toBe(650)

    const withoutZone = await app.inject({ method: 'GET', url: '/v1/menu/items' })
    expect(withoutZone.json().items[0].unit_price_cents).toBe(500)

    await app.close()
  })

  it('POST /v1/menu/items links tags', async () => {
    const app = await createTestApp()
    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Mains',
    })

    const tagRes = await app.inject({
      method: 'POST',
      url: '/v1/menu/tags',
      payload: { code: 'spicy', label: 'Spicy' },
    })
    const tagId = tagRes.json().tag.id

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      payload: {
        category_id: category.id,
        name: 'Curry',
        base_price_cents: 400,
        tag_ids: [tagId],
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().item.tag_ids).toEqual([tagId])
    await app.close()
  })
})
