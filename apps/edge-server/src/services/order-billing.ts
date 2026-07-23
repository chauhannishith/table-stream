import type { DiscountType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { assertHubWritable } from '../lib/hub-guard.js'
import { AppError } from '../lib/errors.js'
import type { OrderLineModifierSnapshot } from '../lib/snapshots.js'
import { getLocationBillingConfig } from '../repositories/location-billing-config.js'
import { listOrderLines } from '../repositories/order-lines.js'
import {
  finalizeOrderBill as persistOrderBill,
  getOrderById,
  type OrderRow,
} from '../repositories/orders.js'
import {
  buildInvoiceTaxSnapshot,
  computeBillPreview,
  loadBillingConfigSnapshot,
  parseServiceChargePercent,
} from './billing.js'
import { getOrderEntry } from './orders.js'

export type BillPreviewInput = {
  discountType?: DiscountType
  discountValue?: number
  tipCents?: number
}

export type BillPreviewDto = {
  subtotal_cents: number
  discount_cents: number
  discounted_subtotal_cents: number
  tax_cents: number
  tax_breakdown: Record<string, number>
  service_charge_cents: number
  tip_cents: number
  total_cents: number
}

function parseModifiers(json: string): OrderLineModifierSnapshot[] {
  return JSON.parse(json) as OrderLineModifierSnapshot[]
}

function toBillPreviewDto(totals: ReturnType<typeof computeBillPreview>): BillPreviewDto {
  return {
    subtotal_cents: totals.subtotalCents,
    discount_cents: totals.discountCents,
    discounted_subtotal_cents: totals.discountedSubtotalCents,
    tax_cents: totals.taxCents,
    tax_breakdown: totals.taxBreakdown,
    service_charge_cents: totals.serviceChargeCents,
    tip_cents: totals.tipCents,
    total_cents: totals.totalCents,
  }
}

function resolveBillInput(
  order: OrderRow,
  input: BillPreviewInput,
): Required<Pick<BillPreviewInput, 'tipCents'>> & {
  discountType?: DiscountType
  discountValue?: number
} {
  return {
    discountType:
      input.discountType ??
      (order.discountType as DiscountType | null | undefined) ??
      undefined,
    discountValue: input.discountValue ?? order.discountValue ?? undefined,
    tipCents: input.tipCents ?? order.tipCents,
  }
}

function computeBillForOrder(
  db: HubDb,
  locationId: string,
  order: OrderRow,
  input: BillPreviewInput,
) {
  const lines = listOrderLines(db, order.id)
  if (lines.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Order has no lines', 400, {
      order_id: order.id,
    })
  }

  const billing = loadBillingConfigSnapshot(db, locationId, order.zoneId)
  const configRow = getLocationBillingConfig(db, locationId)
  const serviceChargeRules = configRow
    ? (JSON.parse(configRow.serviceChargeRulesJson) as Record<string, unknown>)
    : {}
  const serviceChargePercent = parseServiceChargePercent(serviceChargeRules)
  const resolved = resolveBillInput(order, input)

  const totals = computeBillPreview(
    lines.map((line) => ({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      modifiers: parseModifiers(line.modifiersJson),
    })),
    billing,
    serviceChargePercent,
    resolved,
  )

  return { totals, resolved, billing }
}

function assertBillableOrder(order: OrderRow, orderId: string): void {
  if (order.status === 'PAID' || order.status === 'VOID') {
    throw new AppError(
      'CONFLICT',
      'Cannot bill a closed order',
      409,
      { order_id: orderId, status: order.status },
    )
  }
}

/**
 * Preview bill totals for an open order from snapshotted lines and zone/location tax.
 * Request overrides apply to discount/tip; service charge comes from location rules.
 * @throws {AppError} NOT_FOUND when the order is missing; CONFLICT when PAID or VOID
 */
export function previewOrderBill(
  db: HubDb,
  locationId: string,
  orderId: string,
  input: BillPreviewInput = {},
): BillPreviewDto {
  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  assertBillableOrder(order, orderId)

  const { totals } = computeBillForOrder(db, locationId, order, input)

  return toBillPreviewDto(totals)
}

/**
 * Finalize and lock bill totals on an open order from snapshotted lines.
 * @throws {AppError} FORBIDDEN when hub is SUSPENDED; NOT_FOUND; CONFLICT when PAID or VOID
 */
export function finalizeOrderBill(
  db: HubDb,
  locationId: string,
  orderId: string,
  input: BillPreviewInput = {},
) {
  assertHubWritable(db, locationId)

  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  assertBillableOrder(order, orderId)

  const { totals, resolved, billing } = computeBillForOrder(
    db,
    locationId,
    order,
    input,
  )

  const updated = persistOrderBill(db, locationId, orderId, {
    discountType: resolved.discountType ?? null,
    discountValue: resolved.discountValue ?? null,
    discountCents: totals.discountCents,
    serviceChargeCents: totals.serviceChargeCents,
    tipCents: resolved.tipCents,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    billTaxSnapshotJson: JSON.stringify(
      buildInvoiceTaxSnapshot(totals.taxBreakdown, billing.taxComponents),
    ),
  })

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  return getOrderEntry(db, locationId, orderId)!
}
