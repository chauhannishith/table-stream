import { and, asc, eq } from 'drizzle-orm'
import { kdsStations } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type KdsStationRow = typeof kdsStations.$inferSelect

export type ListKdsStationsOptions = {
  includeInactive?: boolean
}

export function listKdsStations(
  db: HubDb,
  locationId: string,
  options: ListKdsStationsOptions = {},
): KdsStationRow[] {
  const conditions = [eq(kdsStations.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(kdsStations.isActive, true))
  }

  return db
    .select()
    .from(kdsStations)
    .where(and(...conditions))
    .orderBy(asc(kdsStations.sortOrder), asc(kdsStations.name))
    .all()
}

export function getKdsStationById(
  db: HubDb,
  locationId: string,
  id: string,
): KdsStationRow | undefined {
  return db
    .select()
    .from(kdsStations)
    .where(
      and(eq(kdsStations.id, id), eq(kdsStations.locationId, locationId)),
    )
    .get()
}

export type CreateKdsStationInput = {
  name: string
  sortOrder?: number
  isActive?: boolean
}

export function createKdsStation(
  db: HubDb,
  locationId: string,
  input: CreateKdsStationInput,
): KdsStationRow {
  const id = newId('kds')
  db.insert(kdsStations)
    .values({
      id,
      locationId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .run()

  const row = getKdsStationById(db, locationId, id)
  if (!row) {
    throw new Error(`KDS station insert failed for ${id}`)
  }
  return row
}

export type UpdateKdsStationInput = {
  name?: string
  sortOrder?: number
  isActive?: boolean
}

export function updateKdsStation(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateKdsStationInput,
): KdsStationRow | null {
  const existing = getKdsStationById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof kdsStations.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(kdsStations)
    .set(patch)
    .where(
      and(eq(kdsStations.id, id), eq(kdsStations.locationId, locationId)),
    )
    .run()

  return getKdsStationById(db, locationId, id) ?? null
}
