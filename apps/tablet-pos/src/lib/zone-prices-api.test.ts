import { describe, expect, it, vi } from 'vitest'
import type { HubApiClient } from './api-client'
import {
  effectiveZonePriceCents,
  listMenuItemsForZone,
  overrideCentsFromResolved,
  parseZonePriceCell,
  setMenuItemZonePrices,
} from './zone-prices-api'

describe('zone price helpers', () => {
  it('falls back to base when override is missing', () => {
    expect(effectiveZonePriceCents(500, null)).toBe(500)
    expect(effectiveZonePriceCents(500, undefined)).toBe(500)
    expect(effectiveZonePriceCents(500, 650)).toBe(650)
  })

  it('treats equal unit/base as inherit for editing', () => {
    expect(overrideCentsFromResolved(500, 500)).toBeNull()
    expect(overrideCentsFromResolved(500, 650)).toBe(650)
  })

  it('parses blank cells as inherit', () => {
    expect(parseZonePriceCell('')).toBeNull()
    expect(parseZonePriceCell('  ')).toBeNull()
    expect(parseZonePriceCell('6.50')).toBe(650)
  })
})

describe('zone prices API helpers', () => {
  it('lists items for a zone and puts overrides', async () => {
    const item = {
      id: 'mi_1',
      location_id: 'loc',
      category_id: 'cat_1',
      name: 'Burger',
      base_price_cents: 500,
      unit_price_cents: 650,
      kds_station_id: null,
      is_active: true,
      tag_ids: [],
      updated_at: '2026-07-25T00:00:00.000Z',
    }
    const client = {
      get: vi.fn(async () => ({ items: [item] })),
      put: vi.fn(async () => ({
        prices: [
          {
            zone_id: 'zn_1',
            price_cents: 650,
            updated_at: '2026-07-25T00:00:00.000Z',
          },
        ],
      })),
    } as unknown as HubApiClient

    await expect(listMenuItemsForZone('zn_1', client)).resolves.toEqual([
      item,
    ])
    expect(client.get).toHaveBeenCalledWith(
      '/v1/menu/items?zone_id=zn_1&include_inactive=true',
    )

    await expect(
      setMenuItemZonePrices(
        'mi_1',
        [{ zone_id: 'zn_1', price_cents: 650 }],
        client,
      ),
    ).resolves.toHaveLength(1)
    expect(client.put).toHaveBeenCalledWith(
      '/v1/menu/items/mi_1/zone-prices',
      { body: { prices: [{ zone_id: 'zn_1', price_cents: 650 }] } },
    )
  })
})
