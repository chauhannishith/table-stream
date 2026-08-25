import type {
  FulfillmentStatus,
  OrderStatus,
  OrderType,
} from '@table-stream/shared-types/domain'

export type OrderLine = {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  quantity: number
  unit_price_cents: number
  tax_cents: number
  line_total_cents: number
  modifiers: unknown[]
  tags: unknown[]
  special_instructions: string | null
  kds_station_id: string | null
  status: string
  is_submitted: boolean
  submitted_at: string | null
  submit_batch: number
  kds_visible: boolean
  version: number
}

export type Order = {
  id: string
  location_id: string
  order_type: OrderType
  table_id: string | null
  zone_id: string | null
  token_number: string | null
  customer_name: string | null
  customer_contact: string | null
  status: OrderStatus
  fulfillment_status: FulfillmentStatus
  server_id: string | null
  discount_type: string | null
  discount_value: number | null
  discount_cents: number
  service_charge_cents: number
  tip_cents: number
  version: number
  opened_at: string
  closed_at: string | null
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  lines: OrderLine[]
}

export type OrderLineWriteInput = {
  menu_item_id: string
  quantity?: number
}

export type OrderLineUpdateInput = {
  quantity?: number
}

export type OrderSubmission = {
  order: Order
  submit_batch: number
  lines: OrderLine[]
}

export type BillInput = {
  discount_type?: 'PERCENT' | 'FIXED'
  discount_value?: number
  tip_cents?: number
}

export type BillPreview = {
  subtotal_cents: number
  discount_cents: number
  discounted_subtotal_cents: number
  tax_cents: number
  tax_breakdown: Record<string, number>
  service_charge_cents: number
  tip_cents: number
  total_cents: number
}

export type TenderType = 'CASH' | 'CARD' | 'OTHER'

export type Payment = {
  id: string
  order_id: string
  status: string
  amount_cents: number
  tender_type: TenderType
  provider: string | null
  provider_ref: string | null
  version: number
  created_at: string
}

export type PaymentResult = {
  payment: Payment
  order: Order
}

export type RecordPaymentInput = {
  tender_type: TenderType
  amount_cents?: number
}

export type InvoiceBusinessSnapshot = {
  legal_name?: string | null
  trade_name?: string | null
  gst_number?: string | null
  address_lines?: unknown
  phone?: string | null
  email?: string | null
  logo_path?: string | null
}

export type Invoice = {
  id: string
  location_id: string
  order_id: string
  payment_id: string
  invoice_number: string
  status: string
  issued_at: string
  voided_at: string | null
  void_reason: string | null
  replaces_invoice_id: string | null
  subtotal_cents: number
  tax_cents: number
  discount_cents: number
  tip_cents: number
  total_cents: number
  tender_summary: Record<string, number>
  line_items: unknown[]
  cashier_id: string | null
  cashier_name: string | null
  token_number: string
  business_snapshot: InvoiceBusinessSnapshot
  tax_breakdown: Record<string, number>
  applied_tax_rules: Record<string, number>
  combined_rate_percent: number
  metadata: Record<string, unknown>
  document_path: string
  content_hash: string
}
