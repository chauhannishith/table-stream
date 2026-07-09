import { eq } from 'drizzle-orm'
import { menuItems } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { getMenuItemZonePrice } from '../repositories/menu-item-zone-prices.js'

export function resolveUnitPriceCents(
  db: HubDb,
  menuItemId: string,
  zoneId?: string,
): number {
  if (zoneId) {
    const zonePrice = getMenuItemZonePrice(db, menuItemId, zoneId)
    if (zonePrice) {
      return zonePrice.priceCents
    }
  }

  const item = db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, menuItemId))
    .get()

  return item?.basePriceCents ?? 0
}
