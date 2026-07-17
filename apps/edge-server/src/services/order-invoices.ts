import { createHash } from 'node:crypto'
import type { HubConfig } from '../config.js'
import type { HubDb } from '../db/client.js'
import { assertHubWritable } from '../lib/hub-guard.js'
import { AppError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import type {
  OrderLineModifierSnapshot,
  OrderLineTagSnapshot,
} from '../lib/snapshots.js'
import { getBusinessProfileSnapshot } from '../repositories/business-profile.js'
import { nextInvoiceNumber } from '../repositories/invoice-counters.js'
import {
  createInvoice,
  getInvoiceById,
  getIssuedInvoiceByOrderId,
  type InvoiceRow,
} from '../repositories/invoices.js'
import { getLocationBillingConfig } from '../repositories/location-billing-config.js'
import { listOrderLines } from '../repositories/order-lines.js'
import { getOrderById } from '../repositories/orders.js'
import { listPaymentsByOrder } from '../repositories/payments.js'
import { getStaffById } from '../repositories/staff.js'
import {
  computeBillPreview,
  loadBillingConfigSnapshot,
  parseServiceChargePercent,
} from './billing.js'

export type IssueInvoiceInput = {
  cashierId?: string | null
}

function parseModifiers(json: string): OrderLineModifierSnapshot[] {
  return JSON.parse(json) as OrderLineModifierSnapshot[]
}

function parseTags(json: string): OrderLineTagSnapshot[] {
  return JSON.parse(json) as OrderLineTagSnapshot[]
}

function buildLineItemsSnapshot(db: HubDb, orderId: string) {
  return listOrderLines(db, orderId).map((line) => ({
    id: line.id,
    menu_item_id: line.menuItemId,
    name: line.name,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
    tax_cents: line.taxCents,
    line_total_cents: line.lineTotalCents,
    modifiers: parseModifiers(line.modifiersJson),
    tags: parseTags(line.tagsJson),
    special_instructions: line.specialInstructions,
  }))
}

function computeTaxBreakdown(
  db: HubDb,
  locationId: string,
  order: NonNullable<ReturnType<typeof getOrderById>>,
) {
  const lines = listOrderLines(db, order.id)
  const billing = loadBillingConfigSnapshot(db, locationId)
  const configRow = getLocationBillingConfig(db, locationId)
  const serviceChargeRules = configRow
    ? (JSON.parse(configRow.serviceChargeRulesJson) as Record<string, unknown>)
    : {}
  const serviceChargePercent = parseServiceChargePercent(serviceChargeRules)

  return computeBillPreview(
    lines.map((line) => ({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      modifiers: parseModifiers(line.modifiersJson),
    })),
    billing,
    serviceChargePercent,
    {
      discountType:
        (order.discountType as 'PERCENT' | 'FIXED' | null | undefined) ??
        undefined,
      discountValue: order.discountValue ?? undefined,
      tipCents: order.tipCents,
    },
  ).taxBreakdown
}

function invoiceDocumentPath(
  dataDir: string,
  locationId: string,
  invoiceId: string,
  issuedAt: string,
): string {
  const [datePart] = issuedAt.split(' ')
  const [year, month] = datePart.split('-')
  return `${dataDir}/invoices/${locationId}/${year}/${month}/${invoiceId}.pdf`
}

function canonicalInvoicePayload(input: {
  invoiceNumber: string
  orderId: string
  paymentId: string
  subtotalCents: number
  taxCents: number
  discountCents: number
  tipCents: number
  totalCents: number
  tenderSummary: Record<string, number>
  lineItems: ReturnType<typeof buildLineItemsSnapshot>
  cashierName: string
  tokenNumber: string
  businessSnapshot: ReturnType<typeof getBusinessProfileSnapshot>
  taxBreakdown: Record<string, number>
  metadata: Record<string, unknown>
}) {
  return {
    invoice_number: input.invoiceNumber,
    order_id: input.orderId,
    payment_id: input.paymentId,
    subtotal_cents: input.subtotalCents,
    tax_cents: input.taxCents,
    discount_cents: input.discountCents,
    tip_cents: input.tipCents,
    total_cents: input.totalCents,
    tender_summary: input.tenderSummary,
    line_items: input.lineItems,
    cashier_name: input.cashierName,
    token_number: input.tokenNumber,
    business_snapshot: input.businessSnapshot,
    tax_breakdown: input.taxBreakdown,
    metadata: input.metadata,
  }
}

function hashInvoicePayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function resolveCashierName(
  db: HubDb,
  locationId: string,
  order: NonNullable<ReturnType<typeof getOrderById>>,
  cashierId?: string | null,
) {
  const staffId = cashierId ?? order.serverId
  if (!staffId) return 'Counter'

  const staff = getStaffById(db, locationId, staffId)
  return staff?.name ?? 'Counter'
}

function toInvoiceDto(row: InvoiceRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    order_id: row.orderId,
    payment_id: row.paymentId,
    invoice_number: row.invoiceNumber,
    status: row.status,
    issued_at: row.issuedAt,
    voided_at: row.voidedAt,
    void_reason: row.voidReason,
    replaces_invoice_id: row.replacesInvoiceId,
    subtotal_cents: row.subtotalCents,
    tax_cents: row.taxCents,
    discount_cents: row.discountCents,
    tip_cents: row.tipCents,
    total_cents: row.totalCents,
    tender_summary: JSON.parse(row.tenderSummaryJson) as Record<string, number>,
    line_items: JSON.parse(row.lineItemsJson) as unknown[],
    cashier_id: row.cashierId,
    cashier_name: row.cashierName,
    token_number: row.tokenNumber,
    business_snapshot: JSON.parse(row.businessSnapshotJson) as Record<
      string,
      unknown
    >,
    tax_breakdown: JSON.parse(row.taxBreakdownJson) as Record<string, number>,
    metadata: JSON.parse(row.metadataJson) as Record<string, unknown>,
    document_path: row.documentPath,
    content_hash: row.contentHash,
  }
}

export function issueOrderInvoice(
  db: HubDb,
  config: HubConfig,
  locationId: string,
  orderId: string,
  input: IssueInvoiceInput = {},
) {
  assertHubWritable(db, locationId)

  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  if (order.status !== 'PAID') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Order must be paid before issuing invoice',
      400,
      { order_id: orderId, status: order.status },
    )
  }

  const existing = getIssuedInvoiceByOrderId(db, locationId, orderId)
  if (existing) {
    throw new AppError(
      'CONFLICT',
      'Invoice already issued for this order',
      409,
      { order_id: orderId, invoice_id: existing.id },
    )
  }

  const payment = listPaymentsByOrder(db, orderId).find(
    (row) => row.status === 'CAPTURED',
  )
  if (!payment) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Captured payment required to issue invoice',
      400,
      { order_id: orderId },
    )
  }

  const issuedAt =
    order.closedAt ?? new Date().toISOString().replace('T', ' ').slice(0, 19)
  const invoiceNumber = nextInvoiceNumber(db, locationId)
  const lineItems = buildLineItemsSnapshot(db, orderId)
  const taxBreakdown = computeTaxBreakdown(db, locationId, order)
  const businessSnapshot = getBusinessProfileSnapshot(db, config.org_id)
  const cashierName = resolveCashierName(db, locationId, order, input.cashierId)
  const tenderType = payment.tenderType?.toLowerCase() ?? 'other'
  const tenderSummary = { [tenderType]: payment.amountCents }
  const metadata = {
    order_type: order.orderType,
    customer_name: order.customerName,
    location_name: config.location_name,
  }

  const canonical = canonicalInvoicePayload({
    invoiceNumber,
    orderId,
    paymentId: payment.id,
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    discountCents: order.discountCents,
    tipCents: order.tipCents,
    totalCents: order.totalCents,
    tenderSummary,
    lineItems,
    cashierName,
    tokenNumber: order.tokenNumber ?? '',
    businessSnapshot,
    taxBreakdown,
    metadata,
  })

  const invoiceId = newId('inv')
  const contentHash = hashInvoicePayload(canonical)
  const documentPath = invoiceDocumentPath(
    config.data_dir,
    locationId,
    invoiceId,
    issuedAt,
  )

  const row = createInvoice(db, {
    id: invoiceId,
    locationId,
    orderId,
    paymentId: payment.id,
    invoiceNumber,
    issuedAt,
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    discountCents: order.discountCents,
    tipCents: order.tipCents,
    totalCents: order.totalCents,
    tenderSummaryJson: JSON.stringify(tenderSummary),
    lineItemsJson: JSON.stringify(lineItems),
    cashierId: input.cashierId ?? order.serverId,
    cashierName,
    tokenNumber: order.tokenNumber ?? '',
    businessSnapshotJson: JSON.stringify(businessSnapshot),
    taxBreakdownJson: JSON.stringify(taxBreakdown),
    metadataJson: JSON.stringify(metadata),
    documentPath,
    contentHash,
  })

  return { invoice: toInvoiceDto(row) }
}

export function getInvoiceEntry(
  db: HubDb,
  locationId: string,
  invoiceId: string,
) {
  const row = getInvoiceById(db, locationId, invoiceId)
  if (!row) return null
  return toInvoiceDto(row)
}
