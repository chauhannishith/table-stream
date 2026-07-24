import { describe, expect, it, vi } from 'vitest'
import type { HubApiClient } from './api-client'
import {
  centsToPriceString,
  createCategory,
  createMenuItem,
  listCategories,
  listMenuItems,
  priceStringToCents,
  updateMenuItem,
} from './menu-api'

describe('price helpers', () => {
  it('parses decimal strings into cents', () => {
    expect(priceStringToCents('0')).toBe(0)
    expect(priceStringToCents('12')).toBe(1200)
    expect(priceStringToCents('12.5')).toBe(1250)
    expect(priceStringToCents('12.50')).toBe(1250)
    expect(priceStringToCents('0.09')).toBe(9)
  })

  it('rejects invalid price strings', () => {
    expect(() => priceStringToCents('')).toThrow(/required/)
    expect(() => priceStringToCents('-1')).toThrow(/non-negative/)
    expect(() => priceStringToCents('12.999')).toThrow(/non-negative amount/)
    expect(() => priceStringToCents('abc')).toThrow(/non-negative amount/)
  })

  it('formats cents for inputs', () => {
    expect(centsToPriceString(0)).toBe('0.00')
    expect(centsToPriceString(1250)).toBe('12.50')
    expect(centsToPriceString(9)).toBe('0.09')
  })
})

describe('menu API helpers', () => {
  it('lists categories and items with include_inactive', async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes('/categories')) {
          return {
            categories: [
              {
                id: 'cat_1',
                location_id: 'loc',
                name: 'Mains',
                sort_order: 0,
                is_active: true,
                updated_at: '2026-07-24T00:00:00.000Z',
              },
            ],
          }
        }
        return {
          items: [
            {
              id: 'mi_1',
              location_id: 'loc',
              category_id: 'cat_1',
              name: 'Curry',
              base_price_cents: 1299,
              unit_price_cents: 1299,
              kds_station_id: null,
              is_active: true,
              tag_ids: [],
              updated_at: '2026-07-24T00:00:00.000Z',
            },
          ],
        }
      }),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(listCategories(client)).resolves.toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith(
      '/v1/menu/categories?include_inactive=true',
    )

    await expect(listMenuItems(client)).resolves.toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith(
      '/v1/menu/items?include_inactive=true',
    )
  })

  it('creates category and menu item, then patches item', async () => {
    const category = {
      id: 'cat_1',
      location_id: 'loc',
      name: 'Mains',
      sort_order: 0,
      is_active: true,
      updated_at: '2026-07-24T00:00:00.000Z',
    }
    const item = {
      id: 'mi_1',
      location_id: 'loc',
      category_id: 'cat_1',
      name: 'Curry',
      base_price_cents: 1299,
      unit_price_cents: 1299,
      kds_station_id: null,
      is_active: true,
      tag_ids: [],
      updated_at: '2026-07-24T00:00:00.000Z',
    }
    const client = {
      get: vi.fn(),
      post: vi.fn(async (path: string) => {
        if (path.includes('/categories')) return { category }
        return { item }
      }),
      patch: vi.fn(async () => ({
        item: { ...item, name: 'House curry', is_active: false },
      })),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(createCategory({ name: 'Mains' }, client)).resolves.toEqual(
      category,
    )
    expect(client.post).toHaveBeenCalledWith('/v1/menu/categories', {
      body: { name: 'Mains' },
    })

    await expect(
      createMenuItem(
        {
          category_id: 'cat_1',
          name: 'Curry',
          base_price_cents: 1299,
        },
        client,
      ),
    ).resolves.toEqual(item)

    await expect(
      updateMenuItem(
        'mi_1',
        { name: 'House curry', is_active: false },
        client,
      ),
    ).resolves.toMatchObject({ name: 'House curry', is_active: false })
  })
})
