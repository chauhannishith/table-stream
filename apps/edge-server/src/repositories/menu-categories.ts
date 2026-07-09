import { and, asc, eq } from 'drizzle-orm'
import { menuCategories } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type MenuCategoryRow = typeof menuCategories.$inferSelect

export type ListMenuCategoriesOptions = {
  includeInactive?: boolean
}

export function listMenuCategories(
  db: HubDb,
  locationId: string,
  options: ListMenuCategoriesOptions = {},
): MenuCategoryRow[] {
  const conditions = [eq(menuCategories.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(menuCategories.isActive, true))
  }

  return db
    .select()
    .from(menuCategories)
    .where(and(...conditions))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name))
    .all()
}

export function getMenuCategoryById(
  db: HubDb,
  locationId: string,
  id: string,
): MenuCategoryRow | undefined {
  return db
    .select()
    .from(menuCategories)
    .where(
      and(eq(menuCategories.id, id), eq(menuCategories.locationId, locationId)),
    )
    .get()
}

export type CreateMenuCategoryInput = {
  name: string
  sortOrder?: number
  isActive?: boolean
}

export function createMenuCategory(
  db: HubDb,
  locationId: string,
  input: CreateMenuCategoryInput,
): MenuCategoryRow {
  const id = newId('cat')
  db.insert(menuCategories)
    .values({
      id,
      locationId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .run()

  const row = getMenuCategoryById(db, locationId, id)
  if (!row) {
    throw new Error(`Menu category insert failed for ${id}`)
  }
  return row
}

export type UpdateMenuCategoryInput = {
  name?: string
  sortOrder?: number
  isActive?: boolean
}

export function updateMenuCategory(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateMenuCategoryInput,
): MenuCategoryRow | null {
  const existing = getMenuCategoryById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof menuCategories.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(menuCategories)
    .set(patch)
    .where(
      and(eq(menuCategories.id, id), eq(menuCategories.locationId, locationId)),
    )
    .run()

  return getMenuCategoryById(db, locationId, id) ?? null
}
