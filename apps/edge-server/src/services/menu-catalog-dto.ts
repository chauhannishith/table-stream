import type { MenuCategoryRow } from '../repositories/menu-categories.js'
import type { MenuItemRow } from '../repositories/menu-items.js'
import type { MenuTagRow } from '../repositories/menu-tags.js'
import type {
  ModifierGroupRow,
  ModifierOptionRow,
} from '../repositories/modifier-groups.js'

export function toMenuCategoryDto(row: MenuCategoryRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    name: row.name,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}

export function toMenuTagDto(row: MenuTagRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    code: row.code,
    label: row.label,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}

export function toMenuItemDto(
  row: MenuItemRow,
  extras: { unit_price_cents: number; tag_ids?: string[] } = {
    unit_price_cents: row.basePriceCents,
  },
) {
  return {
    id: row.id,
    location_id: row.locationId,
    category_id: row.categoryId,
    name: row.name,
    base_price_cents: row.basePriceCents,
    unit_price_cents: extras.unit_price_cents,
    kds_station_id: row.kdsStationId,
    is_active: row.isActive,
    tag_ids: extras.tag_ids ?? [],
    updated_at: row.updatedAt,
  }
}

export function toModifierGroupDto(row: ModifierGroupRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    scope: row.scope,
    category_id: row.categoryId,
    menu_item_id: row.menuItemId,
    name: row.name,
    min_select: row.minSelect,
    max_select: row.maxSelect,
    is_required: row.isRequired,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}

export function toModifierOptionDto(row: ModifierOptionRow) {
  return {
    id: row.id,
    group_id: row.groupId,
    code: row.code,
    label: row.label,
    price_cents: row.priceCents,
    is_default: row.isDefault,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}
