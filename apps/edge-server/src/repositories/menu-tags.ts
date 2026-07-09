import { and, asc, eq } from 'drizzle-orm'
import { menuTags } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { rethrowUniqueAsConflict } from '../lib/sqlite-errors.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type MenuTagRow = typeof menuTags.$inferSelect

export function listMenuTags(
  db: HubDb,
  locationId: string,
  options: { includeInactive?: boolean } = {},
): MenuTagRow[] {
  const conditions = [eq(menuTags.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(menuTags.isActive, true))
  }

  return db
    .select()
    .from(menuTags)
    .where(and(...conditions))
    .orderBy(asc(menuTags.sortOrder), asc(menuTags.label))
    .all()
}

export function getMenuTagById(
  db: HubDb,
  locationId: string,
  id: string,
): MenuTagRow | undefined {
  return db
    .select()
    .from(menuTags)
    .where(and(eq(menuTags.id, id), eq(menuTags.locationId, locationId)))
    .get()
}

export type CreateMenuTagInput = {
  code: string
  label: string
  sortOrder?: number
  isActive?: boolean
}

export function createMenuTag(
  db: HubDb,
  locationId: string,
  input: CreateMenuTagInput,
): MenuTagRow {
  const id = newId('tag')
  try {
    db.insert(menuTags)
      .values({
        id,
        locationId,
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      })
      .run()
  } catch (error) {
    rethrowUniqueAsConflict(error, 'Tag code already exists for this location', {
      code: input.code,
    })
  }

  const row = getMenuTagById(db, locationId, id)
  if (!row) {
    throw new Error(`Menu tag insert failed for ${id}`)
  }
  return row
}

export type UpdateMenuTagInput = {
  code?: string
  label?: string
  sortOrder?: number
  isActive?: boolean
}

export function updateMenuTag(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateMenuTagInput,
): MenuTagRow | null {
  const existing = getMenuTagById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof menuTags.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.code !== undefined) patch.code = input.code
  if (input.label !== undefined) patch.label = input.label
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  try {
    db.update(menuTags)
      .set(patch)
      .where(and(eq(menuTags.id, id), eq(menuTags.locationId, locationId)))
      .run()
  } catch (error) {
    rethrowUniqueAsConflict(error, 'Tag code already exists for this location', {
      code: input.code,
    })
  }

  return getMenuTagById(db, locationId, id) ?? null
}
