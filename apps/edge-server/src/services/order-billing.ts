import type { DiscountType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import type { OrderLineModifierSnapshot } from '../lib/snapshots.js'
import { getLocationBillingConfig } from '../repositories/location-billing-config.js'
import { listOrderLines } from '../repositories/order-lines.js'
import { getOrderById } from '../repositories/orders.js'
import {
  computeBillPreview,
  loadBillingConfigSnapshot,
  parseServiceChargePercent,
} from './billing.js'

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

  if (order.status === 'PAID' || order.status === 'VOID') {
    throw new AppError(
      'CONFLICT',
      'Cannot preview bill for a closed order',
      409,
      { order_id: orderId, status: order.status },
    )
  }

  const lines = listOrderLines(db, orderId)
  const billing = loadBillingConfigSnapshot(db, locationId)

  const configRow = getLocationBillingConfig(db, locationId)
  const serviceChargeRules = configRow
    ? (JSON.parse(configRow.serviceChargeRulesJson) as Record<string, unknown>)
    : {}
  const serviceChargePercent = parseServiceChargePercent(serviceChargeRules)

  const discountType =
    input.discountType ??
    (order.discountType as DiscountType | null | undefined) ??
    undefined
  const discountValue =
    input.discountValue ?? order.discountValue ?? undefined
  const tipCents = input.tipCents ?? order.tipCents

  const totals = computeBillPreview(
    lines.map((line) => ({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      modifiers: parseModifiers(line.modifiersJson),
    })),
    billing,
    serviceChargePercent,
    { discountType, discountValue, tipCents },
  )

  return toBillPreviewDto(totals)
}
