import { and, eq } from 'drizzle-orm'
import { zones } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'

export type ZoneRow = typeof zones.$inferSelect

export function getZoneById(
  db: HubDb,
  locationId: string,
  id: string,
): ZoneRow | undefined {
  return db
    .select()
    .from(zones)
    .where(and(eq(zones.id, id), eq(zones.locationId, locationId)))
    .get()
}

export function createZone(
  db: HubDb,
  locationId: string,
  input: { name: string; sortOrder?: number },
) {
  const id = newId('zone')
  db.insert(zones)
    .values({
      id,
      locationId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .run()

  return id
}
