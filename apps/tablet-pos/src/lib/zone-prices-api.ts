import { api, type HubApiClient } from './api-client'
import {
  priceStringToCents,
  type MenuItem,
} from './menu-api'

export type ZonePrice = {
  zone_id: string
  price_cents: number
  updated_at: string
}

/** List menu items with unit prices resolved for a zone (falls back to base). */
export async function listMenuItemsForZone(
  zoneId: string,
  client: HubApiClient = api,
): Promise<MenuItem[]> {
  const result = await client.get<{ items: MenuItem[] }>(
    `/v1/menu/items?zone_id=${encodeURIComponent(zoneId)}&include_inactive=true`,
  )
  return result.items
}

/** Replace/upsert zone price overrides for one menu item. */
export async function setMenuItemZonePrices(
  menuItemId: string,
  prices: Array<{ zone_id: string; price_cents: number }>,
  client: HubApiClient = api,
): Promise<ZonePrice[]> {
  const result = await client.put<{ prices: ZonePrice[] }>(
    `/v1/menu/items/${menuItemId}/zone-prices`,
    { body: { prices } },
  )
  return result.prices
}

/**
 * Effective cents for a grid cell.
 * `overrideCents` null/undefined means inherit the item base price.
 */
export function effectiveZonePriceCents(
  basePriceCents: number,
  overrideCents: number | null | undefined,
): number {
  return overrideCents ?? basePriceCents
}

/**
 * Infer an override from a zone-resolved item.
 * When unit equals base, treat as inherit (no distinct override to edit).
 */
export function overrideCentsFromResolved(
  basePriceCents: number,
  unitPriceCents: number,
): number | null {
  return unitPriceCents === basePriceCents ? null : unitPriceCents
}

/**
 * Parse a grid cell string.
 * Blank means inherit base (null); otherwise a non-negative money amount.
 */
export function parseZonePriceCell(raw: string): number | null {
  if (!raw.trim()) return null
  return priceStringToCents(raw)
}
