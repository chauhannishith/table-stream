import { api, type HubApiClient } from './api-client'
import type {
  BillInput,
  BillPreview,
  Invoice,
  Order,
  PaymentResult,
  RecordPaymentInput,
} from './orders-types'

export type {
  BillInput,
  BillPreview,
  Invoice,
  Payment,
  PaymentResult,
  RecordPaymentInput,
  TenderType,
} from './orders-types'

function buildBillBody(input: BillInput): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (input.discount_type !== undefined) {
    body.discount_type = input.discount_type
  }
  if (input.discount_value !== undefined) {
    body.discount_value = input.discount_value
  }
  if (input.tip_cents !== undefined) {
    body.tip_cents = input.tip_cents
  }
  return body
}

/** Preview bill totals without locking the order. */
export async function previewOrderBill(
  orderId: string,
  input: BillInput = {},
  client: HubApiClient = api,
): Promise<BillPreview> {
  const result = await client.post<{ preview: BillPreview }>(
    `/v1/orders/${encodeURIComponent(orderId)}/bill/preview`,
    { body: buildBillBody(input) },
  )
  return result.preview
}

/** Finalize and lock bill totals on the order (status → CHECK_PRINTED). */
export async function finalizeOrderBill(
  orderId: string,
  input: BillInput = {},
  client: HubApiClient = api,
): Promise<Order> {
  const result = await client.post<{ order: Order }>(
    `/v1/orders/${encodeURIComponent(orderId)}/bill`,
    { body: buildBillBody(input) },
  )
  return result.order
}

/**
 * Record full payment for a billed order (hub requires CHECK_PRINTED).
 * Amount defaults to the locked order total when omitted.
 */
export async function recordOrderPayment(
  orderId: string,
  input: RecordPaymentInput,
  client: HubApiClient = api,
): Promise<PaymentResult> {
  const body: Record<string, unknown> = {
    tender_type: input.tender_type,
  }
  if (input.amount_cents !== undefined) {
    body.amount_cents = input.amount_cents
  }

  return client.post<PaymentResult>(
    `/v1/orders/${encodeURIComponent(orderId)}/payments`,
    { body },
  )
}

/** Issue a local invoice for a paid order (hub returns 409 if already issued). */
export async function issueOrderInvoice(
  orderId: string,
  client: HubApiClient = api,
): Promise<Invoice> {
  const result = await client.post<{ invoice: Invoice }>(
    `/v1/orders/${encodeURIComponent(orderId)}/invoice`,
    { body: {} },
  )
  return result.invoice
}

/** Load an issued invoice snapshot for reprint. */
export async function getInvoice(
  invoiceId: string,
  client: HubApiClient = api,
): Promise<Invoice> {
  const result = await client.get<{ invoice: Invoice }>(
    `/v1/invoices/${encodeURIComponent(invoiceId)}`,
  )
  return result.invoice
}
