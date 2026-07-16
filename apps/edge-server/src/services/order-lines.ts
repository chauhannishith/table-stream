import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  buildModifierSnapshots,
  buildTagSnapshots,
  type ModifierSelection,
  type OrderLineModifierSnapshot,
  type OrderLineTagSnapshot,
} from '../lib/snapshots.js'
import {
  getLocationBillingConfig,
} from '../repositories/location-billing-config.js'
import {
  getMenuItemById,
  getMenuItemTagIds,
} from '../repositories/menu-items.js'
import { getMenuTagById } from '../repositories/menu-tags.js'
import {
  createOrderLine,
  deleteOrderLine,
  getOrderLineById,
  listOrderLines,
  updateOrderLine,
  type OrderLineRow,
} from '../repositories/order-lines.js'
import {
  getModifierGroupById,
  getModifierOptionById,
} from '../repositories/modifier-groups.js'
import { getOrderById, updateOrderTotals } from '../repositories/orders.js'
import {
  computeLineAmounts,
  computeOrderTotalsFromLines,
  parseTaxComponents,
  type BillingConfigSnapshot,
} from './billing.js'
import { resolveUnitPriceCents } from './pricing.js'
import { toOrderLineDto } from './orders-dto.js'

function loadBillingConfig(
  db: HubDb,
  locationId: string,
): BillingConfigSnapshot {
  const row = getLocationBillingConfig(db, locationId)
  if (!row) {
    return { priceTaxMode: 'EXCLUSIVE', taxComponents: {} }
  }

  return {
    priceTaxMode: row.priceTaxMode as BillingConfigSnapshot['priceTaxMode'],
    taxComponents: parseTaxComponents(
      JSON.parse(row.taxRulesJson) as Record<string, unknown>,
    ),
  }
}

function loadModifierOptions(
  db: HubDb,
  locationId: string,
  selections: ModifierSelection[],
) {
  const optionsById = new Map<
    string,
    {
      id: string
      code: string
      label: string
      priceCents: number
      groupId: string
      groupName: string
      groupScope: 'CATEGORY' | 'ITEM'
    }
  >()

  for (const selection of selections) {
    const option = getModifierOptionById(db, selection.option_id)
    if (!option) {
      throw new AppError('NOT_FOUND', 'Modifier option not found', 404, {
        option_id: selection.option_id,
      })
    }

    const group = getModifierGroupById(db, locationId, option.groupId)
    if (!group) {
      throw new AppError('NOT_FOUND', 'Modifier group not found', 404, {
        group_id: option.groupId,
      })
    }

    optionsById.set(option.id, {
      id: option.id,
      code: option.code,
      label: option.label,
      priceCents: option.priceCents,
      groupId: group.id,
      groupName: group.name,
      groupScope: group.scope as 'CATEGORY' | 'ITEM',
    })
  }

  return optionsById
}

function loadTagSnapshots(
  db: HubDb,
  locationId: string,
  menuItemId: string,
): OrderLineTagSnapshot[] {
  const tagIds = getMenuItemTagIds(db, menuItemId)
  const tags = []
  for (const tagId of tagIds) {
    const tag = getMenuTagById(db, locationId, tagId)
    if (tag) {
      tags.push({ id: tag.id, code: tag.code, label: tag.label })
    }
  }
  return buildTagSnapshots(tags)
}

function parseModifiers(json: string): OrderLineModifierSnapshot[] {
  return JSON.parse(json) as OrderLineModifierSnapshot[]
}

function refreshOrderTotals(db: HubDb, locationId: string, orderId: string) {
  const billing = loadBillingConfig(db, locationId)
  const lines = listOrderLines(db, orderId)
  const totals = computeOrderTotalsFromLines(
    lines.map((line) => ({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      modifiers: parseModifiers(line.modifiersJson),
    })),
    billing,
  )

  updateOrderTotals(db, locationId, orderId, {
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    discountCents: totals.discountCents,
    serviceChargeCents: totals.serviceChargeCents,
  })
}

export function assertDraftLine(line: OrderLineRow) {
  if (line.isSubmitted) {
    throw new AppError(
      'CONFLICT',
      'Submitted lines cannot be modified',
      409,
      { line_id: line.id },
    )
  }
}

export type AddLineInput = {
  menuItemId: string
  quantity?: number
  modifiers?: ModifierSelection[]
  specialInstructions?: string | null
}

export function addLine(
  db: HubDb,
  locationId: string,
  orderId: string,
  input: AddLineInput,
) {
  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { id: orderId })
  }

  const item = getMenuItemById(db, locationId, input.menuItemId)
  if (!item) {
    throw new AppError('NOT_FOUND', 'Menu item not found', 404, {
      menu_item_id: input.menuItemId,
    })
  }

  const quantity = input.quantity ?? 1
  if (quantity < 1) {
    throw new AppError('VALIDATION_ERROR', 'quantity must be at least 1', 400)
  }

  const selections = input.modifiers ?? []
  const optionsById = loadModifierOptions(db, locationId, selections)
  let modifiers: OrderLineModifierSnapshot[]
  try {
    modifiers = buildModifierSnapshots(selections, optionsById)
  } catch (error) {
    throw new AppError(
      'NOT_FOUND',
      error instanceof Error ? error.message : 'Modifier option not found',
      404,
    )
  }

  const tags = loadTagSnapshots(db, locationId, item.id)
  const unitPriceCents = resolveUnitPriceCents(db, item.id, order.zoneId)
  const billing = loadBillingConfig(db, locationId)
  const amounts = computeLineAmounts({
    unitPriceCents,
    quantity,
    modifiers,
    billing,
  })

  const row = createOrderLine(db, orderId, {
    menuItemId: item.id,
    name: item.name,
    quantity,
    unitPriceCents: amounts.unitPriceCents,
    taxCents: amounts.taxCents,
    lineTotalCents: amounts.lineTotalCents,
    modifiersJson: JSON.stringify(modifiers),
    tagsJson: JSON.stringify(tags),
    specialInstructions: input.specialInstructions ?? null,
    kdsStationId: item.kdsStationId,
  })

  refreshOrderTotals(db, locationId, orderId)
  return toOrderLineDto(row)
}

export type UpdateDraftLineInput = {
  quantity?: number
  modifiers?: ModifierSelection[]
  specialInstructions?: string | null
}

export function updateDraftLine(
  db: HubDb,
  locationId: string,
  orderId: string,
  lineId: string,
  input: UpdateDraftLineInput,
) {
  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { id: orderId })
  }

  const existing = getOrderLineById(db, orderId, lineId)
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Order line not found', 404, {
      line_id: lineId,
    })
  }
  assertDraftLine(existing)

  const quantity = input.quantity ?? existing.quantity
  if (quantity < 1) {
    throw new AppError('VALIDATION_ERROR', 'quantity must be at least 1', 400)
  }

  let modifiers = parseModifiers(existing.modifiersJson)
  if (input.modifiers !== undefined) {
    const optionsById = loadModifierOptions(db, locationId, input.modifiers)
    try {
      modifiers = buildModifierSnapshots(input.modifiers, optionsById)
    } catch (error) {
      throw new AppError(
        'NOT_FOUND',
        error instanceof Error ? error.message : 'Modifier option not found',
        404,
      )
    }
  }

  const billing = loadBillingConfig(db, locationId)
  const amounts = computeLineAmounts({
    unitPriceCents: existing.unitPriceCents,
    quantity,
    modifiers,
    billing,
  })

  const row = updateOrderLine(
    db,
    orderId,
    lineId,
    pickDefined({
      quantity,
      taxCents: amounts.taxCents,
      lineTotalCents: amounts.lineTotalCents,
      modifiersJson: JSON.stringify(modifiers),
      specialInstructions: input.specialInstructions,
    }),
  )

  refreshOrderTotals(db, locationId, orderId)
  return row ? toOrderLineDto(row) : null
}

export function removeDraftLine(
  db: HubDb,
  locationId: string,
  orderId: string,
  lineId: string,
) {
  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { id: orderId })
  }

  const existing = getOrderLineById(db, orderId, lineId)
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Order line not found', 404, {
      line_id: lineId,
    })
  }
  assertDraftLine(existing)

  deleteOrderLine(db, orderId, lineId)
  refreshOrderTotals(db, locationId, orderId)
}
