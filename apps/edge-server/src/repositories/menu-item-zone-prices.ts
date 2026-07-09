import { and, eq } from 'drizzle-orm'
import { menuItemZonePrices } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type MenuItemZonePriceRow = typeof menuItemZonePrices.$inferSelect

export function getMenuItemZonePrice(
  db: HubDb,
  menuItemId: string,
  zoneId: string,
): MenuItemZonePriceRow | undefined {
  return db
    .select()
    .from(menuItemZonePrices)
    .where(
      and(
        eq(menuItemZonePrices.menuItemId, menuItemId),
        eq(menuItemZonePrices.zoneId, zoneId),
      ),
    )
    .get()
}

export function listMenuItemZonePrices(
  db: HubDb,
  menuItemId: string,
): MenuItemZonePriceRow[] {
  return db
    .select()
    .from(menuItemZonePrices)
    .where(eq(menuItemZonePrices.menuItemId, menuItemId))
    .all()
}

export type ZonePriceInput = {
  zoneId: string
  priceCents: number
}

export function upsertMenuItemZonePrices(
  db: HubDb,
  menuItemId: string,
  prices: ZonePriceInput[],
): MenuItemZonePriceRow[] {
  const updatedAt = nowSqliteTimestamp()

  for (const price of prices) {
    db.insert(menuItemZonePrices)
      .values({
        menuItemId,
        zoneId: price.zoneId,
        priceCents: price.priceCents,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [menuItemZonePrices.menuItemId, menuItemZonePrices.zoneId],
        set: {
          priceCents: price.priceCents,
          updatedAt,
        },
      })
      .run()
  }

  return listMenuItemZonePrices(db, menuItemId)
}
