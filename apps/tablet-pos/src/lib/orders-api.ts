import type {
  FulfillmentStatus,
  OrderStatus,
  OrderType,
} from '@table-stream/shared-types/domain'
import { api, type HubApiClient } from './api-client'

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

/** Trim takeaway customer name; hub requires non-empty for TAKEAWAY. */
export function normalizeCustomerName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('customer name is required')
  }
  return trimmed
}

/** Create a draft TAKEAWAY order (hub returns 404 when zone_id is unknown). */
export async function createTakeawayOrder(
  input: {
    zone_id: string
    customer_name: string
    customer_contact?: string | null
  },
  client: HubApiClient = api,
): Promise<Order> {
  const body: Record<string, unknown> = {
    order_type: 'TAKEAWAY',
    zone_id: input.zone_id,
    customer_name: normalizeCustomerName(input.customer_name),
  }
  if (input.customer_contact !== undefined) {
    body.customer_contact = input.customer_contact?.trim() || null
  }

  const result = await client.post<{ order: Order }>('/v1/orders', { body })
  return result.order
}
