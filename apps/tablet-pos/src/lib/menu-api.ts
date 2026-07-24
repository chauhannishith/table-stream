import { api, type HubApiClient } from './api-client'

export type MenuCategory = {
  id: string
  location_id: string
  name: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type MenuItem = {
  id: string
  location_id: string
  category_id: string
  name: string
  base_price_cents: number
  unit_price_cents: number
  kds_station_id: string | null
  is_active: boolean
  tag_ids: string[]
  updated_at: string
}

export type MenuItemWriteInput = {
  category_id?: string
  name?: string
  base_price_cents?: number
  is_active?: boolean
}

/** Parse a decimal money string (e.g. "12.50") into integer cents. */
export function priceStringToCents(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('base price is required')
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('base price must be a non-negative amount (e.g. 12.50)')
  }
  const [whole = '0', frac = ''] = trimmed.split('.')
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error('base price must be a non-negative amount (e.g. 12.50)')
  }
  return cents
}

/** Format integer cents as a decimal money string for inputs. */
export function centsToPriceString(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error('cents must be a non-negative integer')
  }
  const whole = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, '0')
  return `${whole}.${frac}`
}

/** List categories (include inactive for setup). */
export async function listCategories(
  client: HubApiClient = api,
): Promise<MenuCategory[]> {
  const result = await client.get<{ categories: MenuCategory[] }>(
    '/v1/menu/categories?include_inactive=true',
  )
  return result.categories
}

/** Create a menu category (minimal helper until F1.3). */
export async function createCategory(
  input: { name: string },
  client: HubApiClient = api,
): Promise<MenuCategory> {
  const result = await client.post<{ category: MenuCategory }>(
    '/v1/menu/categories',
    { body: { name: input.name.trim() } },
  )
  return result.category
}

/** List menu items (include inactive for setup reactivation). */
export async function listMenuItems(
  client: HubApiClient = api,
): Promise<MenuItem[]> {
  const result = await client.get<{ items: MenuItem[] }>(
    '/v1/menu/items?include_inactive=true',
  )
  return result.items
}

/** Create a menu item. */
export async function createMenuItem(
  input: {
    category_id: string
    name: string
    base_price_cents: number
  },
  client: HubApiClient = api,
): Promise<MenuItem> {
  const result = await client.post<{ item: MenuItem }>('/v1/menu/items', {
    body: {
      category_id: input.category_id,
      name: input.name.trim(),
      base_price_cents: input.base_price_cents,
    },
  })
  return result.item
}

/** Patch menu item fields (rename, price, category, activate/deactivate). */
export async function updateMenuItem(
  id: string,
  input: MenuItemWriteInput,
  client: HubApiClient = api,
): Promise<MenuItem> {
  const body: MenuItemWriteInput = {}
  if (input.category_id !== undefined) body.category_id = input.category_id
  if (input.name !== undefined) body.name = input.name.trim()
  if (input.base_price_cents !== undefined) {
    body.base_price_cents = input.base_price_cents
  }
  if (input.is_active !== undefined) body.is_active = input.is_active

  const result = await client.patch<{ item: MenuItem }>(
    `/v1/menu/items/${id}`,
    { body },
  )
  return result.item
}
