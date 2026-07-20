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
