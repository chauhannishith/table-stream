import { and, asc, eq } from 'drizzle-orm'
import {
  modifierGroups,
  modifierOptions,
} from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import { rethrowUniqueAsConflict } from '../lib/sqlite-errors.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'
import { getMenuCategoryById } from './menu-categories.js'
import { getMenuItemById } from './menu-items.js'

export type ModifierGroupRow = typeof modifierGroups.$inferSelect
export type ModifierOptionRow = typeof modifierOptions.$inferSelect
export type ModifierScope = 'CATEGORY' | 'ITEM'

export type ListModifierGroupsFilter = {
  categoryId?: string
  menuItemId?: string
  includeInactive?: boolean
}

export function listModifierGroups(
  db: HubDb,
  locationId: string,
  filter: ListModifierGroupsFilter = {},
): ModifierGroupRow[] {
  const conditions = [eq(modifierGroups.locationId, locationId)]

  if (filter.categoryId) {
    conditions.push(eq(modifierGroups.categoryId, filter.categoryId))
    conditions.push(eq(modifierGroups.scope, 'CATEGORY'))
  }

  if (filter.menuItemId) {
    conditions.push(eq(modifierGroups.menuItemId, filter.menuItemId))
    conditions.push(eq(modifierGroups.scope, 'ITEM'))
  }

  if (!filter.includeInactive) {
    conditions.push(eq(modifierGroups.isActive, true))
  }

  return db
    .select()
    .from(modifierGroups)
    .where(and(...conditions))
    .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.name))
    .all()
}

export function getModifierGroupById(
  db: HubDb,
  locationId: string,
  id: string,
): ModifierGroupRow | undefined {
  return db
    .select()
    .from(modifierGroups)
    .where(
      and(eq(modifierGroups.id, id), eq(modifierGroups.locationId, locationId)),
    )
    .get()
}

export type CreateModifierGroupInput = {
  scope: ModifierScope
  categoryId?: string | null
  menuItemId?: string | null
  name: string
  minSelect?: number
  maxSelect?: number | null
  isRequired?: boolean
  sortOrder?: number
  isActive?: boolean
}

function validateModifierGroupScope(
  db: HubDb,
  locationId: string,
  input: CreateModifierGroupInput,
) {
  if (input.scope === 'CATEGORY') {
    if (!input.categoryId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'category_id is required for CATEGORY scope',
        400,
      )
    }
    if (!getMenuCategoryById(db, locationId, input.categoryId)) {
      throw new AppError('NOT_FOUND', 'Category not found', 404, {
        category_id: input.categoryId,
      })
    }
    return
  }

  if (!input.menuItemId) {
    throw new AppError(
      'VALIDATION_ERROR',
      'menu_item_id is required for ITEM scope',
      400,
    )
  }
  if (!getMenuItemById(db, locationId, input.menuItemId)) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404, {
      menu_item_id: input.menuItemId,
    })
  }
}

export function createModifierGroup(
  db: HubDb,
  locationId: string,
  input: CreateModifierGroupInput,
): ModifierGroupRow {
  validateModifierGroupScope(db, locationId, input)

  const id = newId('mgrp')
  db.insert(modifierGroups)
    .values({
      id,
      locationId,
      scope: input.scope,
      categoryId: input.scope === 'CATEGORY' ? input.categoryId! : null,
      menuItemId: input.scope === 'ITEM' ? input.menuItemId! : null,
      name: input.name,
      minSelect: input.minSelect ?? 0,
      maxSelect: input.maxSelect ?? null,
      isRequired: input.isRequired ?? false,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .run()

  const row = getModifierGroupById(db, locationId, id)
  if (!row) {
    throw new Error(`Modifier group insert failed for ${id}`)
  }
  return row
}

export type UpdateModifierGroupInput = {
  name?: string
  minSelect?: number
  maxSelect?: number | null
  isRequired?: boolean
  sortOrder?: number
  isActive?: boolean
}

export function updateModifierGroup(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateModifierGroupInput,
): ModifierGroupRow | null {
  const existing = getModifierGroupById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof modifierGroups.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.minSelect !== undefined) patch.minSelect = input.minSelect
  if (input.maxSelect !== undefined) patch.maxSelect = input.maxSelect
  if (input.isRequired !== undefined) patch.isRequired = input.isRequired
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(modifierGroups)
    .set(patch)
    .where(
      and(eq(modifierGroups.id, id), eq(modifierGroups.locationId, locationId)),
    )
    .run()

  return getModifierGroupById(db, locationId, id) ?? null
}

export function listModifierOptions(
  db: HubDb,
  groupId: string,
  options: { includeInactive?: boolean } = {},
): ModifierOptionRow[] {
  const conditions = [eq(modifierOptions.groupId, groupId)]
  if (!options.includeInactive) {
    conditions.push(eq(modifierOptions.isActive, true))
  }

  return db
    .select()
    .from(modifierOptions)
    .where(and(...conditions))
    .orderBy(asc(modifierOptions.sortOrder), asc(modifierOptions.label))
    .all()
}

export function getModifierOptionById(
  db: HubDb,
  id: string,
): ModifierOptionRow | undefined {
  return db
    .select()
    .from(modifierOptions)
    .where(eq(modifierOptions.id, id))
    .get()
}

export type CreateModifierOptionInput = {
  code: string
  label: string
  priceCents?: number
  isDefault?: boolean
  sortOrder?: number
  isActive?: boolean
}

export function createModifierOption(
  db: HubDb,
  groupId: string,
  input: CreateModifierOptionInput,
): ModifierOptionRow {
  const id = newId('mopt')
  try {
    db.insert(modifierOptions)
      .values({
        id,
        groupId,
        code: input.code,
        label: input.label,
        priceCents: input.priceCents ?? 0,
        isDefault: input.isDefault ?? false,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      })
      .run()
  } catch (error) {
    rethrowUniqueAsConflict(error, 'Modifier option code already exists for this group', {
      code: input.code,
    })
  }

  const row = getModifierOptionById(db, id)
  if (!row) {
    throw new Error(`Modifier option insert failed for ${id}`)
  }
  return row
}

export type UpdateModifierOptionInput = {
  code?: string
  label?: string
  priceCents?: number
  isDefault?: boolean
  sortOrder?: number
  isActive?: boolean
}

export function updateModifierOption(
  db: HubDb,
  id: string,
  input: UpdateModifierOptionInput,
): ModifierOptionRow | null {
  const existing = getModifierOptionById(db, id)
  if (!existing) return null

  const patch: Partial<typeof modifierOptions.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.code !== undefined) patch.code = input.code
  if (input.label !== undefined) patch.label = input.label
  if (input.priceCents !== undefined) patch.priceCents = input.priceCents
  if (input.isDefault !== undefined) patch.isDefault = input.isDefault
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  try {
    db.update(modifierOptions)
      .set(patch)
      .where(eq(modifierOptions.id, id))
      .run()
  } catch (error) {
    rethrowUniqueAsConflict(error, 'Modifier option code already exists for this group', {
      code: input.code,
    })
  }

  return getModifierOptionById(db, id) ?? null
}
