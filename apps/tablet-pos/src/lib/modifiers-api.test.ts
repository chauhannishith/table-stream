import { describe, expect, it, vi } from 'vitest'
import type { HubApiClient } from './api-client'
import {
  createItemModifierGroup,
  createModifierOption,
  listItemModifierGroups,
  listModifierOptions,
  updateModifierGroup,
  updateModifierOption,
} from './modifiers-api'

const group = {
  id: 'mg_1',
  location_id: 'loc',
  scope: 'ITEM' as const,
  category_id: null,
  menu_item_id: 'mi_1',
  name: 'Extras',
  min_select: 0,
  max_select: 2,
  is_required: false,
  sort_order: 0,
  is_active: true,
  updated_at: '2026-07-25T00:00:00.000Z',
}

const option = {
  id: 'mo_1',
  group_id: 'mg_1',
  code: 'cheese',
  label: 'Extra cheese',
  price_cents: 150,
  is_default: false,
  sort_order: 0,
  is_active: true,
  updated_at: '2026-07-25T00:00:00.000Z',
}

describe('modifier group API helpers', () => {
  it('lists item groups with inactive rows', async () => {
    const client = {
      get: vi.fn(async () => ({ modifier_groups: [group] })),
    } as unknown as HubApiClient

    await expect(listItemModifierGroups('mi_1', client)).resolves.toEqual([
      group,
    ])
    expect(client.get).toHaveBeenCalledWith(
      '/v1/menu/modifier-groups?menu_item_id=mi_1&include_inactive=true',
    )
  })

  it('creates and updates item-scoped groups', async () => {
    const client = {
      post: vi.fn(async () => ({ modifier_group: group })),
      patch: vi.fn(async () => ({
        modifier_group: { ...group, name: 'Toppings', is_active: false },
      })),
    } as unknown as HubApiClient

    await expect(
      createItemModifierGroup(
        {
          menu_item_id: 'mi_1',
          name: ' Extras ',
          min_select: 0,
          max_select: 2,
        },
        client,
      ),
    ).resolves.toEqual(group)
    expect(client.post).toHaveBeenCalledWith('/v1/menu/modifier-groups', {
      body: {
        scope: 'ITEM',
        menu_item_id: 'mi_1',
        name: 'Extras',
        min_select: 0,
        max_select: 2,
      },
    })

    await updateModifierGroup(
      'mg_1',
      { name: 'Toppings', is_active: false },
      client,
    )
    expect(client.patch).toHaveBeenCalledWith(
      '/v1/menu/modifier-groups/mg_1',
      { body: { name: 'Toppings', is_active: false } },
    )
  })
})

describe('modifier option API helpers', () => {
  it('lists, creates, and updates options with price extras', async () => {
    const client = {
      get: vi.fn(async () => ({ options: [option] })),
      post: vi.fn(async () => ({ option })),
      patch: vi.fn(async () => ({
        option: { ...option, price_cents: 200, is_active: false },
      })),
    } as unknown as HubApiClient

    await expect(listModifierOptions('mg_1', client)).resolves.toEqual([
      option,
    ])
    expect(client.get).toHaveBeenCalledWith(
      '/v1/menu/modifier-groups/mg_1/options?include_inactive=true',
    )

    await expect(
      createModifierOption(
        'mg_1',
        {
          code: ' cheese ',
          label: ' Extra cheese ',
          price_cents: 150,
        },
        client,
      ),
    ).resolves.toEqual(option)
    expect(client.post).toHaveBeenCalledWith(
      '/v1/menu/modifier-groups/mg_1/options',
      {
        body: {
          code: 'cheese',
          label: 'Extra cheese',
          price_cents: 150,
        },
      },
    )

    await updateModifierOption(
      'mo_1',
      { price_cents: 200, is_active: false },
      client,
    )
    expect(client.patch).toHaveBeenCalledWith(
      '/v1/menu/modifier-options/mo_1',
      { body: { price_cents: 200, is_active: false } },
    )
  })
})
