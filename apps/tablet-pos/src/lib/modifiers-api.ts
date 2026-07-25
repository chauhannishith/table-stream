import { api, type HubApiClient } from './api-client'

export type ModifierGroup = {
  id: string
  location_id: string
  scope: 'CATEGORY' | 'ITEM'
  category_id: string | null
  menu_item_id: string | null
  name: string
  min_select: number
  max_select: number | null
  is_required: boolean
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type ModifierOption = {
  id: string
  group_id: string
  code: string
  label: string
  price_cents: number
  is_default: boolean
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type ModifierGroupWriteInput = {
  name?: string
  min_select?: number
  max_select?: number | null
  is_required?: boolean
  sort_order?: number
  is_active?: boolean
}

export type ModifierOptionWriteInput = {
  code?: string
  label?: string
  price_cents?: number
  is_default?: boolean
  sort_order?: number
  is_active?: boolean
}

/** List item-scoped modifier groups, including inactive groups for setup. */
export async function listItemModifierGroups(
  menuItemId: string,
  client: HubApiClient = api,
): Promise<ModifierGroup[]> {
  const result = await client.get<{ modifier_groups: ModifierGroup[] }>(
    `/v1/menu/modifier-groups?menu_item_id=${encodeURIComponent(menuItemId)}&include_inactive=true`,
  )
  return result.modifier_groups
}

/** Create an item-scoped modifier group. */
export async function createItemModifierGroup(
  input: {
    menu_item_id: string
    name: string
    min_select?: number
    max_select?: number | null
    is_required?: boolean
  },
  client: HubApiClient = api,
): Promise<ModifierGroup> {
  const body: {
    scope: 'ITEM'
    menu_item_id: string
    name: string
    min_select?: number
    max_select?: number | null
    is_required?: boolean
  } = {
    scope: 'ITEM',
    menu_item_id: input.menu_item_id,
    name: input.name.trim(),
  }
  if (input.min_select !== undefined) body.min_select = input.min_select
  if (input.max_select !== undefined) body.max_select = input.max_select
  if (input.is_required !== undefined) body.is_required = input.is_required

  const result = await client.post<{ modifier_group: ModifierGroup }>(
    '/v1/menu/modifier-groups',
    { body },
  )
  return result.modifier_group
}

/** Patch modifier group selection rules or active state. */
export async function updateModifierGroup(
  id: string,
  input: ModifierGroupWriteInput,
  client: HubApiClient = api,
): Promise<ModifierGroup> {
  const body: ModifierGroupWriteInput = {}
  if (input.name !== undefined) body.name = input.name.trim()
  if (input.min_select !== undefined) body.min_select = input.min_select
  if (input.max_select !== undefined) body.max_select = input.max_select
  if (input.is_required !== undefined) body.is_required = input.is_required
  if (input.sort_order !== undefined) body.sort_order = input.sort_order
  if (input.is_active !== undefined) body.is_active = input.is_active

  const result = await client.patch<{ modifier_group: ModifierGroup }>(
    `/v1/menu/modifier-groups/${id}`,
    { body },
  )
  return result.modifier_group
}

/** List modifier options, including inactive options for setup. */
export async function listModifierOptions(
  groupId: string,
  client: HubApiClient = api,
): Promise<ModifierOption[]> {
  const result = await client.get<{ options: ModifierOption[] }>(
    `/v1/menu/modifier-groups/${groupId}/options?include_inactive=true`,
  )
  return result.options
}

/** Create an option in a modifier group. */
export async function createModifierOption(
  groupId: string,
  input: {
    code: string
    label: string
    price_cents?: number
    is_default?: boolean
  },
  client: HubApiClient = api,
): Promise<ModifierOption> {
  const body: ModifierOptionWriteInput = {
    code: input.code.trim(),
    label: input.label.trim(),
  }
  if (input.price_cents !== undefined) body.price_cents = input.price_cents
  if (input.is_default !== undefined) body.is_default = input.is_default

  const result = await client.post<{ option: ModifierOption }>(
    `/v1/menu/modifier-groups/${groupId}/options`,
    { body },
  )
  return result.option
}

/** Patch modifier option fields, price extra, or active state. */
export async function updateModifierOption(
  id: string,
  input: ModifierOptionWriteInput,
  client: HubApiClient = api,
): Promise<ModifierOption> {
  const body: ModifierOptionWriteInput = {}
  if (input.code !== undefined) body.code = input.code.trim()
  if (input.label !== undefined) body.label = input.label.trim()
  if (input.price_cents !== undefined) body.price_cents = input.price_cents
  if (input.is_default !== undefined) body.is_default = input.is_default
  if (input.sort_order !== undefined) body.sort_order = input.sort_order
  if (input.is_active !== undefined) body.is_active = input.is_active

  const result = await client.patch<{ option: ModifierOption }>(
    `/v1/menu/modifier-options/${id}`,
    { body },
  )
  return result.option
}
