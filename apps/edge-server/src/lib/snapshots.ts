export type ModifierSelection = {
  option_id: string
  quantity?: number
}

export type OrderLineModifierSnapshot = {
  kind: 'category_option' | 'item_option'
  group_id: string
  group_name: string
  option_id: string
  code: string
  label: string
  price_cents: number
  quantity: number
}

export type OrderLineTagSnapshot = {
  tag_id: string
  code: string
  label: string
}

export type ModifierOptionForSnapshot = {
  id: string
  code: string
  label: string
  priceCents: number
  groupId: string
  groupName: string
  groupScope: 'CATEGORY' | 'ITEM'
}

export type TagForSnapshot = {
  id: string
  code: string
  label: string
}

export function buildModifierSnapshots(
  selections: ModifierSelection[],
  optionsById: Map<string, ModifierOptionForSnapshot>,
): OrderLineModifierSnapshot[] {
  const snapshots: OrderLineModifierSnapshot[] = []

  for (const selection of selections) {
    const option = optionsById.get(selection.option_id)
    if (!option) {
      throw new Error(`Modifier option not found: ${selection.option_id}`)
    }

    const quantity = selection.quantity ?? 1
    snapshots.push({
      kind: option.groupScope === 'CATEGORY' ? 'category_option' : 'item_option',
      group_id: option.groupId,
      group_name: option.groupName,
      option_id: option.id,
      code: option.code,
      label: option.label,
      price_cents: option.priceCents,
      quantity,
    })
  }

  return snapshots
}

export function buildTagSnapshots(
  tags: TagForSnapshot[],
): OrderLineTagSnapshot[] {
  return tags.map((tag) => ({
    tag_id: tag.id,
    code: tag.code,
    label: tag.label,
  }))
}

export function modifierExtraCents(
  snapshots: OrderLineModifierSnapshot[],
): number {
  return snapshots.reduce(
    (sum, snap) => sum + snap.price_cents * snap.quantity,
    0,
  )
}
