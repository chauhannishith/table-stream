export const STAFF_MAX_PIN_FAILURES = 5
export const STAFF_LOCKOUT_MS = 15 * 60 * 1000

type LockoutRecord = {
  failures: number
  lockedUntilMs: number | null
}

const store = new Map<string, LockoutRecord>()

function key(locationId: string, staffId: string): string {
  return `${locationId}:${staffId}`
}

/** Whether the staff member is currently locked out of PIN login. */
export function isStaffLockedOut(
  locationId: string,
  staffId: string,
  now = Date.now(),
): boolean {
  const record = store.get(key(locationId, staffId))
  if (!record?.lockedUntilMs) return false
  if (record.lockedUntilMs <= now) {
    store.delete(key(locationId, staffId))
    return false
  }
  return true
}

/** Remaining lockout end timestamp in ms, if locked. */
export function getStaffLockoutUntilMs(
  locationId: string,
  staffId: string,
  now = Date.now(),
): number | null {
  const record = store.get(key(locationId, staffId))
  if (!record?.lockedUntilMs) return null
  if (record.lockedUntilMs <= now) {
    store.delete(key(locationId, staffId))
    return null
  }
  return record.lockedUntilMs
}

/** Record a failed PIN attempt; locks after STAFF_MAX_PIN_FAILURES. */
export function recordStaffPinFailure(
  locationId: string,
  staffId: string,
  now = Date.now(),
): { failures: number; locked: boolean; lockedUntilMs: number | null } {
  const k = key(locationId, staffId)
  const existing = store.get(k)
  if (existing?.lockedUntilMs && existing.lockedUntilMs > now) {
    return {
      failures: existing.failures,
      locked: true,
      lockedUntilMs: existing.lockedUntilMs,
    }
  }

  const failures = (existing?.failures ?? 0) + 1
  if (failures >= STAFF_MAX_PIN_FAILURES) {
    const lockedUntilMs = now + STAFF_LOCKOUT_MS
    store.set(k, { failures, lockedUntilMs })
    return { failures, locked: true, lockedUntilMs }
  }

  store.set(k, { failures, lockedUntilMs: null })
  return { failures, locked: false, lockedUntilMs: null }
}

/** Clear failure/lockout state after a successful login. */
export function clearStaffPinFailures(
  locationId: string,
  staffId: string,
): void {
  store.delete(key(locationId, staffId))
}

/** Clear all lockout state (tests). */
export function clearAllStaffLockouts(): void {
  store.clear()
}
