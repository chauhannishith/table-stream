export type LeaseResourceType = 'table' | 'order_slot' | 'payment_intent'

/** Redis key for an atomic resource lease. */
export function leaseKey(
  locationId: string,
  resourceType: LeaseResourceType,
  resourceId: string,
): string {
  return `ts:lease:${locationId}:${resourceType}:${resourceId}`
}

/** Companion HASH key for lease holder metadata. */
export function leaseMetaKey(locationId: string, leaseToken: string): string {
  return `ts:lease:${locationId}:meta:${leaseToken}`
}

/** Sorted-set key for a station's KDS queue. */
export function kdsQueueKey(stationId: string): string {
  return `ts:kds:${stationId}:queue`
}

/** Hash key for one queued KDS line item. */
export function kdsItemKey(stationId: string, orderLineId: string): string {
  return `ts:kds:${stationId}:item:${orderLineId}`
}

/** Redis stream key for cross-client hub domain events. */
export function streamEventsKey(): string {
  return 'ts:stream:events'
}
