import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  menuItemTags,
  menuItems,
} from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'
import { getMenuCategoryById } from './menu-categories.js'

export type MenuItemRow = typeof menuItems.$inferSelect

export function listMenuItems(
  db: HubDb,
  locationId: string,
  options: { includeInactive?: boolean } = {},
): MenuItemRow[] {
  const conditions = [eq(menuItems.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(menuItems.isActive, true))
  }

  return db
    .select()
    .from(menuItems)
    .where(and(...conditions))
    .orderBy(asc(menuItems.name))
    .all()
}

export function getMenuItemById(
  db: HubDb,
  locationId: string,
  id: string,
): MenuItemRow | undefined {
  return db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.locationId, locationId)))
    .get()
}

export type CreateMenuItemInput = {
  categoryId: string
  name: string
  basePriceCents: number
  kdsStationId?: string | null
  isActive?: boolean
  tagIds?: string[]
}

export function createMenuItem(
  db: HubDb,
  locationId: string,
  input: CreateMenuItemInput,
): MenuItemRow {
  const category = getMenuCategoryById(db, locationId, input.categoryId)
  if (!category) {
    throw new AppError('NOT_FOUND', 'Category not found', 404, {
      category_id: input.categoryId,
    })
  }

  const id = newId('item')
  db.insert(menuItems)
    .values({
      id,
      locationId,
      categoryId: input.categoryId,
      name: input.name,
      basePriceCents: input.basePriceCents,
      kdsStationId: input.kdsStationId ?? null,
      isActive: input.isActive ?? true,
    })
    .run()

  if (input.tagIds?.length) {
    setMenuItemTags(db, id, input.tagIds)
  }

  const row = getMenuItemById(db, locationId, id)
  if (!row) {
    throw new Error(`Menu item insert failed for ${id}`)
  }
  return row
}

export type UpdateMenuItemInput = {
  categoryId?: string
  name?: string
  basePriceCents?: number
  kdsStationId?: string | null
  isActive?: boolean
  tagIds?: string[]
}

export function updateMenuItem(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateMenuItemInput,
): MenuItemRow | null {
  const existing = getMenuItemById(db, locationId, id)
  if (!existing) return null

  if (input.categoryId !== undefined) {
    const category = getMenuCategoryById(db, locationId, input.categoryId)
    if (!category) {
      throw new AppError('NOT_FOUND', 'Category not found', 404, {
        category_id: input.categoryId,
      })
    }
  }

  const patch: Partial<typeof menuItems.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId
  if (input.name !== undefined) patch.name = input.name
  if (input.basePriceCents !== undefined) patch.basePriceCents = input.basePriceCents
  if (input.kdsStationId !== undefined) patch.kdsStationId = input.kdsStationId
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(menuItems)
    .set(patch)
    .where(and(eq(menuItems.id, id), eq(menuItems.locationId, locationId)))
    .run()

  if (input.tagIds !== undefined) {
    setMenuItemTags(db, id, input.tagIds)
  }

  return getMenuItemById(db, locationId, id) ?? null
}

export function getMenuItemTagIds(db: HubDb, menuItemId: string): string[] {
  return db
    .select({ tagId: menuItemTags.tagId })
    .from(menuItemTags)
    .where(eq(menuItemTags.menuItemId, menuItemId))
    .all()
    .map((row) => row.tagId)
}

function setMenuItemTags(db: HubDb, menuItemId: string, tagIds: string[]) {
  db.delete(menuItemTags)
    .where(eq(menuItemTags.menuItemId, menuItemId))
    .run()

  if (tagIds.length === 0) return

  db.insert(menuItemTags)
    .values(tagIds.map((tagId) => ({ menuItemId, tagId })))
    .run()
}

export function listMenuItemsByIds(
  db: HubDb,
  locationId: string,
  ids: string[],
): MenuItemRow[] {
  if (ids.length === 0) return []

  return db
    .select()
    .from(menuItems)
    .where(
      and(eq(menuItems.locationId, locationId), inArray(menuItems.id, ids)),
    )
    .all()
}
