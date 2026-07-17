import { and, eq } from 'drizzle-orm'
import { invoices } from '@table-stream/shared-types/hub'
import type { InvoiceStatus } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'

export type InvoiceRow = typeof invoices.$inferSelect

export type CreateInvoiceInput = {
  id: string
  locationId: string
  orderId: string
  paymentId: string
  invoiceNumber: string
  issuedAt: string
  subtotalCents: number
  taxCents: number
  discountCents: number
  tipCents: number
  totalCents: number
  tenderSummaryJson: string
  lineItemsJson: string
  cashierId?: string | null
  cashierName: string
  tokenNumber: string
  businessSnapshotJson: string
  taxBreakdownJson: string
  metadataJson: string
  documentPath: string
  contentHash: string
  status?: InvoiceStatus
}

export function getInvoiceById(
  db: HubDb,
  locationId: string,
  id: string,
): InvoiceRow | undefined {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.locationId, locationId)))
    .get()
}

export function getIssuedInvoiceByOrderId(
  db: HubDb,
  locationId: string,
  orderId: string,
): InvoiceRow | undefined {
  return db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.locationId, locationId),
        eq(invoices.orderId, orderId),
        eq(invoices.status, 'ISSUED'),
      ),
    )
    .get()
}

export function createInvoice(db: HubDb, input: CreateInvoiceInput): InvoiceRow {
  db.insert(invoices)
    .values({
      id: input.id,
      locationId: input.locationId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      invoiceNumber: input.invoiceNumber,
      status: input.status ?? 'ISSUED',
      issuedAt: input.issuedAt,
      subtotalCents: input.subtotalCents,
      taxCents: input.taxCents,
      discountCents: input.discountCents,
      tipCents: input.tipCents,
      totalCents: input.totalCents,
      tenderSummaryJson: input.tenderSummaryJson,
      lineItemsJson: input.lineItemsJson,
      cashierId: input.cashierId ?? null,
      cashierName: input.cashierName,
      tokenNumber: input.tokenNumber,
      businessSnapshotJson: input.businessSnapshotJson,
      taxBreakdownJson: input.taxBreakdownJson,
      metadataJson: input.metadataJson,
      documentPath: input.documentPath,
      contentHash: input.contentHash,
    })
    .run()

  const row = getInvoiceById(db, input.locationId, input.id)
  if (!row) {
    throw new Error(`Invoice insert failed for ${input.id}`)
  }
  return row
}
