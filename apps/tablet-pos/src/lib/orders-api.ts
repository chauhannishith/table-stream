import { api, type HubApiClient } from './api-client'
import type {
  Order,
  OrderLine,
  OrderLineUpdateInput,
  OrderLineWriteInput,
  OrderSubmission,
} from './orders-types'

export type * from './orders-types'

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

/** Load one order with current draft lines and totals. */
export async function getOrder(
  orderId: string,
  client: HubApiClient = api,
): Promise<Order> {
  const result = await client.get<{ order: Order }>(
    `/v1/orders/${encodeURIComponent(orderId)}`,
  )
  return result.order
}

/** Add one menu item line to a draft order. */
export async function addOrderLine(
  orderId: string,
  input: OrderLineWriteInput,
  client: HubApiClient = api,
): Promise<OrderLine> {
  const body: OrderLineWriteInput = {
    menu_item_id: input.menu_item_id,
  }
  if (input.quantity !== undefined) {
    body.quantity = input.quantity
  }

  const result = await client.post<{ line: OrderLine }>(
    `/v1/orders/${encodeURIComponent(orderId)}/lines`,
    { body },
  )
  return result.line
}

/** Update a draft order line (hub rejects submitted lines with 409). */
export async function updateOrderLine(
  orderId: string,
  lineId: string,
  input: OrderLineUpdateInput,
  client: HubApiClient = api,
): Promise<OrderLine> {
  const body: OrderLineUpdateInput = {}
  if (input.quantity !== undefined) {
    body.quantity = input.quantity
  }

  const result = await client.patch<{ line: OrderLine }>(
    `/v1/orders/${encodeURIComponent(orderId)}/lines/${encodeURIComponent(lineId)}`,
    { body },
  )
  return result.line
}

/** Remove a draft order line (hub rejects submitted lines with 409). */
export async function removeOrderLine(
  orderId: string,
  lineId: string,
  client: HubApiClient = api,
): Promise<void> {
  await client.delete(
    `/v1/orders/${encodeURIComponent(orderId)}/lines/${encodeURIComponent(lineId)}`,
  )
}

/**
 * Submit draft lines to kitchen; takeaway orders receive a token on first submit.
 * Hub returns 400 when there are no draft lines.
 */
export async function submitOrder(
  orderId: string,
  options: { idempotencyKey?: string } = {},
  client: HubApiClient = api,
): Promise<OrderSubmission> {
  const headers: Record<string, string> = {}
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  const result = await client.post<{ submission: OrderSubmission }>(
    `/v1/orders/${encodeURIComponent(orderId)}/submit`,
    { headers },
  )
  return result.submission
}
