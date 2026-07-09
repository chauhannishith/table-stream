import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createCategory } from '../services/menu-catalog.js'

describe('GET /v1/menu/categories', () => {
  it('returns an empty list when no categories exist', async () => {
    const app = await createTestApp()

    const res = await app.inject({ method: 'GET', url: '/v1/menu/categories' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ categories: [] })

    await app.close()
  })

  it('returns seeded categories for the hub location', async () => {
    const app = await createTestApp()
    createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Pizza',
      sortOrder: 0,
    })
    createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Beverages',
      sortOrder: 1,
    })

    const res = await app.inject({ method: 'GET', url: '/v1/menu/categories' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.categories).toHaveLength(2)
    expect(body.categories[0].name).toBe('Pizza')
    expect(body.categories[1].name).toBe('Beverages')

    await app.close()
  })
})
