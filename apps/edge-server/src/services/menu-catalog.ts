import type { HubDb } from '../db/client.js'
import {
  createMenuCategory,
  listMenuCategories,
  updateMenuCategory,
  type CreateMenuCategoryInput,
  type ListMenuCategoriesOptions,
  type UpdateMenuCategoryInput,
} from '../repositories/menu-categories.js'
import { toMenuCategoryDto } from './menu-catalog-dto.js'

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
