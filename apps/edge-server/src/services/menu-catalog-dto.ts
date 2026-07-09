import type { MenuCategoryRow } from '../repositories/menu-categories.js'

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
