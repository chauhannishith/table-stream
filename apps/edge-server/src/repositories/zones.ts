import { and, asc, eq } from 'drizzle-orm'
import { zones } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type ZoneRow = typeof zones.$inferSelect

export type ListZonesOptions = {
  includeInactive?: boolean
}

export function listZones(
  db: HubDb,
  locationId: string,
  options: ListZonesOptions = {},
): ZoneRow[] {
  const conditions = [eq(zones.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(zones.isActive, true))
  }

  return db
    .select()
    .from(zones)
    .where(and(...conditions))
    .orderBy(asc(zones.sortOrder), asc(zones.name))
    .all()
}

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

export type CreateZoneInput = {
  name: string
  sortOrder?: number
  isActive?: boolean
}

export function createZone(
  db: HubDb,
  locationId: string,
  input: CreateZoneInput,
): ZoneRow {
  const id = newId('zone')
  db.insert(zones)
    .values({
      id,
      locationId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .run()

  const row = getZoneById(db, locationId, id)
  if (!row) {
    throw new Error(`Zone insert failed for ${id}`)
  }
  return row
}

export type UpdateZoneInput = {
  name?: string
  sortOrder?: number
  isActive?: boolean
}

export function updateZone(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateZoneInput,
): ZoneRow | null {
  const existing = getZoneById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof zones.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(zones)
    .set(patch)
    .where(and(eq(zones.id, id), eq(zones.locationId, locationId)))
    .run()

  return getZoneById(db, locationId, id) ?? null
}
