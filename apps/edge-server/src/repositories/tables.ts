import { and, asc, eq } from 'drizzle-orm'
import { tables } from '@table-stream/shared-types/hub'
import type { TableStatus } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'
import { getZoneById } from './zones.js'

export type TableRow = typeof tables.$inferSelect

export type ListTablesOptions = {
  zoneId?: string
}

export function listTables(
  db: HubDb,
  locationId: string,
  options: ListTablesOptions = {},
): TableRow[] {
  const conditions = [eq(tables.locationId, locationId)]
  if (options.zoneId) {
    conditions.push(eq(tables.zoneId, options.zoneId))
  }

  return db
    .select()
    .from(tables)
    .where(and(...conditions))
    .orderBy(asc(tables.label))
    .all()
}

export function getTableById(
  db: HubDb,
  locationId: string,
  id: string,
): TableRow | undefined {
  return db
    .select()
    .from(tables)
    .where(and(eq(tables.id, id), eq(tables.locationId, locationId)))
    .get()
}

export type CreateTableInput = {
  zoneId: string
  label: string
  capacity?: number
  posX?: number | null
  posY?: number | null
  status?: TableStatus
}

export function createTable(
  db: HubDb,
  locationId: string,
  input: CreateTableInput,
): TableRow {
  if (!getZoneById(db, locationId, input.zoneId)) {
    throw new Error(`Zone not found: ${input.zoneId}`)
  }

  const id = newId('tbl')
  db.insert(tables)
    .values({
      id,
      locationId,
      zoneId: input.zoneId,
      label: input.label,
      capacity: input.capacity ?? 2,
      posX: input.posX ?? null,
      posY: input.posY ?? null,
      status: input.status ?? 'AVAILABLE',
    })
    .run()

  const row = getTableById(db, locationId, id)
  if (!row) {
    throw new Error(`Table insert failed for ${id}`)
  }
  return row
}

export type UpdateTableInput = {
  zoneId?: string
  label?: string
  capacity?: number
  posX?: number | null
  posY?: number | null
  status?: TableStatus
}

export function updateTable(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateTableInput,
): TableRow | null {
  const existing = getTableById(db, locationId, id)
  if (!existing) return null

  if (input.zoneId !== undefined && !getZoneById(db, locationId, input.zoneId)) {
    throw new Error(`Zone not found: ${input.zoneId}`)
  }

  const patch: Partial<typeof tables.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
    version: existing.version + 1,
  }
  if (input.zoneId !== undefined) patch.zoneId = input.zoneId
  if (input.label !== undefined) patch.label = input.label
  if (input.capacity !== undefined) patch.capacity = input.capacity
  if (input.posX !== undefined) patch.posX = input.posX
  if (input.posY !== undefined) patch.posY = input.posY
  if (input.status !== undefined) patch.status = input.status

  db.update(tables)
    .set(patch)
    .where(and(eq(tables.id, id), eq(tables.locationId, locationId)))
    .run()

  return getTableById(db, locationId, id) ?? null
}
