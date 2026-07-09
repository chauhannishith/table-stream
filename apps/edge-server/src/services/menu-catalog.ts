import type { HubDb } from '../db/client.js'
import {
  createMenuCategory,
  listMenuCategories,
  updateMenuCategory,
  type CreateMenuCategoryInput,
  type ListMenuCategoriesOptions,
  type UpdateMenuCategoryInput,
} from '../repositories/menu-categories.js'
import {
  createMenuItem,
  getMenuItemById,
  getMenuItemTagIds,
  listMenuItems,
  updateMenuItem,
  type CreateMenuItemInput,
  type UpdateMenuItemInput,
} from '../repositories/menu-items.js'
import {
  upsertMenuItemZonePrices,
  type ZonePriceInput,
} from '../repositories/menu-item-zone-prices.js'
import { getZoneById } from '../repositories/zones.js'
import {
  createMenuTag,
  listMenuTags,
  updateMenuTag,
  type CreateMenuTagInput,
  type UpdateMenuTagInput,
} from '../repositories/menu-tags.js'
import {
  createModifierGroup,
  createModifierOption,
  getModifierGroupById,
  getModifierOptionById,
  listModifierGroups,
  listModifierOptions,
  updateModifierGroup,
  updateModifierOption,
  type CreateModifierGroupInput,
  type CreateModifierOptionInput,
  type ListModifierGroupsFilter,
  type UpdateModifierGroupInput,
  type UpdateModifierOptionInput,
} from '../repositories/modifier-groups.js'
import { AppError } from '../lib/errors.js'
import { resolveUnitPriceCents } from './pricing.js'
import {
  toMenuCategoryDto,
  toMenuItemDto,
  toMenuTagDto,
  toModifierGroupDto,
  toModifierOptionDto,
} from './menu-catalog-dto.js'

export function listCategories(
  db: HubDb,
  locationId: string,
  options: ListMenuCategoriesOptions = {},
) {
  return listMenuCategories(db, locationId, options).map(toMenuCategoryDto)
}

export function createCategory(
  db: HubDb,
  locationId: string,
  input: CreateMenuCategoryInput,
) {
  return toMenuCategoryDto(createMenuCategory(db, locationId, input))
}

export function updateCategory(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateMenuCategoryInput,
) {
  const row = updateMenuCategory(db, locationId, id, input)
  return row ? toMenuCategoryDto(row) : null
}

export function listTags(
  db: HubDb,
  locationId: string,
  options: { includeInactive?: boolean } = {},
) {
  return listMenuTags(db, locationId, options).map(toMenuTagDto)
}

export function createTag(
  db: HubDb,
  locationId: string,
  input: CreateMenuTagInput,
) {
  return toMenuTagDto(createMenuTag(db, locationId, input))
}

export function updateTag(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateMenuTagInput,
) {
  const row = updateMenuTag(db, locationId, id, input)
  return row ? toMenuTagDto(row) : null
}

export function listMenuForZone(
  db: HubDb,
  locationId: string,
  zoneId?: string,
  options: { includeInactive?: boolean } = {},
) {
  return listMenuItems(db, locationId, options).map((row) =>
    toMenuItemDto(row, {
      unit_price_cents: resolveUnitPriceCents(db, row.id, zoneId),
      tag_ids: getMenuItemTagIds(db, row.id),
    }),
  )
}

export function createMenuItemEntry(
  db: HubDb,
  locationId: string,
  input: CreateMenuItemInput,
) {
  const row = createMenuItem(db, locationId, input)
  return toMenuItemDto(row, {
    unit_price_cents: row.basePriceCents,
    tag_ids: getMenuItemTagIds(db, row.id),
  })
}

export function updateMenuItemEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateMenuItemInput,
) {
  const row = updateMenuItem(db, locationId, id, input)
  if (!row) return null

  return toMenuItemDto(row, {
    unit_price_cents: row.basePriceCents,
    tag_ids: getMenuItemTagIds(db, row.id),
  })
}

export function setMenuItemZonePrices(
  db: HubDb,
  locationId: string,
  menuItemId: string,
  prices: ZonePriceInput[],
) {
  const item = getMenuItemById(db, locationId, menuItemId)
  if (!item) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404, {
      menu_item_id: menuItemId,
    })
  }

  for (const price of prices) {
    if (!getZoneById(db, locationId, price.zoneId)) {
      throw new AppError('NOT_FOUND', 'Zone not found', 404, {
        zone_id: price.zoneId,
      })
    }
  }

  const rows = upsertMenuItemZonePrices(db, menuItemId, prices)
  return rows.map((row) => ({
    zone_id: row.zoneId,
    price_cents: row.priceCents,
    updated_at: row.updatedAt,
  }))
}

export function listModifierGroupsForLocation(
  db: HubDb,
  locationId: string,
  filter: ListModifierGroupsFilter = {},
) {
  return listModifierGroups(db, locationId, filter).map(toModifierGroupDto)
}

export function createModifierGroupEntry(
  db: HubDb,
  locationId: string,
  input: CreateModifierGroupInput,
) {
  return toModifierGroupDto(createModifierGroup(db, locationId, input))
}

export function updateModifierGroupEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateModifierGroupInput,
) {
  const row = updateModifierGroup(db, locationId, id, input)
  return row ? toModifierGroupDto(row) : null
}

export function listModifierOptionsForGroup(
  db: HubDb,
  locationId: string,
  groupId: string,
  options: { includeInactive?: boolean } = {},
) {
  const group = getModifierGroupById(db, locationId, groupId)
  if (!group) {
    throw new AppError('NOT_FOUND', 'Modifier group not found', 404, {
      id: groupId,
    })
  }

  return listModifierOptions(db, groupId, options).map(toModifierOptionDto)
}

export function createModifierOptionEntry(
  db: HubDb,
  locationId: string,
  groupId: string,
  input: CreateModifierOptionInput,
) {
  const group = getModifierGroupById(db, locationId, groupId)
  if (!group) {
    throw new AppError('NOT_FOUND', 'Modifier group not found', 404, {
      id: groupId,
    })
  }

  return toModifierOptionDto(createModifierOption(db, groupId, input))
}

export function updateModifierOptionEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateModifierOptionInput,
) {
  const option = getModifierOptionById(db, id)
  if (!option) return null

  const group = getModifierGroupById(db, locationId, option.groupId)
  if (!group) return null

  const row = updateModifierOption(db, id, input)
  return row ? toModifierOptionDto(row) : null
}
