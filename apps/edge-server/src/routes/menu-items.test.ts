import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createCategory } from '../services/menu-catalog.js'
import { createZone } from '../repositories/zones.js'
import { upsertLocation } from '../repositories/locations.js'

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

  it('POST /v1/menu/items returns 404 for unknown category', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      payload: {
        category_id: 'cat_missing',
        name: 'Burger',
        base_price_cents: 500,
      },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })

  it('PATCH /v1/menu/items/:id returns 404 for unknown category', async () => {
    const app = await createTestApp()
    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Mains',
    })

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

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/menu/items/${item.id}`,
      payload: { category_id: 'cat_missing' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })

  it('PUT /v1/menu/items/:id/zone-prices rejects zones from another location', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })

    upsertLocation(app.hubDb, {
      id: 'loc_other',
      orgId: app.hubConfig.org_id,
      name: 'Other Location',
      timezone: 'UTC',
      hubId: 'hub_other',
      cloudSyncEnabled: false,
    })
    const otherZoneId = createZone(app.hubDb, 'loc_other', { name: 'Other Patio' })

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

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/menu/items/${item.id}/zone-prices`,
      payload: { prices: [{ zone_id: otherZoneId, price_cents: 650 }] },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })

  it('PUT /v1/menu/items/:id/zone-prices works for inactive items', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/menu/items',
      payload: {
        category_id: category.id,
        name: 'Old Special',
        base_price_cents: 300,
      },
    })
    const item = createRes.json().item
    const zoneId = createZone(app.hubDb, locationId, { name: 'Bar' })

    await app.inject({
      method: 'PATCH',
      url: `/v1/menu/items/${item.id}`,
      payload: { is_active: false },
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/menu/items/${item.id}/zone-prices`,
      payload: { prices: [{ zone_id: zoneId, price_cents: 350 }] },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().prices).toEqual([
      expect.objectContaining({ zone_id: zoneId, price_cents: 350 }),
    ])

    await app.close()
  })
})
