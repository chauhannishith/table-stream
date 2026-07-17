import { randomInt } from 'node:crypto'

export type PairingCodeRecord = {
  locationId: string
  code: string
  expiresAtMs: number
}

const store = new Map<string, PairingCodeRecord>()

function storageKey(locationId: string, code: string): string {
  return `${locationId}:${code}`
}

function pruneExpired(now = Date.now()): void {
  for (const [key, record] of store) {
    if (record.expiresAtMs <= now) store.delete(key)
  }
}

/** Create a short-lived 6-digit pairing code for a location (in-memory). */
export function issuePairingCode(
  locationId: string,
  ttlMs = 5 * 60 * 1000,
): PairingCodeRecord {
  pruneExpired()
  const code = String(randomInt(100000, 1000000))
  const record: PairingCodeRecord = {
    locationId,
    code,
    expiresAtMs: Date.now() + ttlMs,
  }
  store.set(storageKey(locationId, code), record)
  return record
}

/** Consume a pairing code once; returns false when missing or expired. */
export function consumePairingCode(
  locationId: string,
  code: string,
): boolean {
  pruneExpired()
  const key = storageKey(locationId, code.trim())
  const record = store.get(key)
  if (!record) return false
  store.delete(key)
  return true
}

/** Clear all in-memory pairing codes (tests). */
export function clearPairingCodes(): void {
  store.clear()
}
