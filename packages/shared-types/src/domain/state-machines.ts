import type { OrderLineStatus, OrderStatus } from './enums.js'

/** Valid order-level status transitions */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  DRAFT: ['SUBMITTED', 'VOID'],
  SUBMITTED: ['IN_KITCHEN', 'VOID'],
  IN_KITCHEN: ['SERVED', 'VOID'],
  SERVED: ['CHECK_PRINTED', 'VOID'],
  CHECK_PRINTED: ['PAID', 'VOID'],
  PAID: [],
  VOID: [],
}

/** Valid order-line status transitions */
export const ORDER_LINE_STATUS_TRANSITIONS: Record<
  OrderLineStatus,
  readonly OrderLineStatus[]
> = {
  DRAFT: ['QUEUED', 'VOID'],
  QUEUED: ['IN_PROGRESS', 'DRAFT', 'VOID', 'RECALLED'],
  IN_PROGRESS: ['PREPARED', 'RECALLED'],
  PREPARED: ['SERVED'],
  SERVED: [],
  VOID: [],
  RECALLED: ['VOID'],
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to)
}

export function canTransitionOrderLineStatus(
  from: OrderLineStatus,
  to: OrderLineStatus,
): boolean {
  return ORDER_LINE_STATUS_TRANSITIONS[from].includes(to)
}
