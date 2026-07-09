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

describe('POST /v1/menu/categories', () => {
  it('creates a category', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/categories',
      payload: { name: 'Starters', sort_order: 0 },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.category.name).toBe('Starters')
    expect(body.category.is_active).toBe(true)

    await app.close()
  })
})

describe('PATCH /v1/menu/categories/:id', () => {
  it('updates name and is_active', async () => {
    const app = await createTestApp()
    const created = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Old Name',
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/menu/categories/${created.id}`,
      payload: { name: 'New Name', is_active: false },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.category.name).toBe('New Name')
    expect(body.category.is_active).toBe(false)

    await app.close()
  })

  it('returns 404 for unknown category', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/menu/categories/cat_missing',
      payload: { name: 'Nope' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })
})
