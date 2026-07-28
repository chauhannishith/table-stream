import { randomInt } from 'node:crypto'

export type PairingCodeRecord = {
  locationId: string
  code: string
  expiresAtMs: number
}

const store = new Map<string, PairingCodeRecord>()

export const ISSUE_PAIRING_CODE_TTL_MS = 5 * 60 * 1000
export const REGISTER_PAIRING_CODE_TTL_MS = 60 * 60 * 1000

function storageKey(locationId: string, code: string): string {
  return `${locationId}:${code}`
}

function pruneExpired(now = Date.now()): void {
  for (const [key, record] of store) {
    if (record.expiresAtMs <= now) store.delete(key)
  }
}

function resolveTtlMs(ttlMs: number | undefined, defaultTtlMs: number): number {
  return ttlMs ?? defaultTtlMs
}

/** Create a short-lived 6-digit pairing code for a location (in-memory). */
export function issuePairingCode(
  locationId: string,
  ttlMs?: number,
): PairingCodeRecord {
  const resolvedTtlMs = resolveTtlMs(ttlMs, ISSUE_PAIRING_CODE_TTL_MS)
  pruneExpired()
  const code = String(randomInt(100000, 1000000))
  const record: PairingCodeRecord = {
    locationId,
    code,
    expiresAtMs: Date.now() + resolvedTtlMs,
  }
  store.set(storageKey(locationId, code), record)
  return record
}

/** Register a specific 6-digit code (dev bootstrap — same value as staff PIN). */
export function registerPairingCode(
  locationId: string,
  code: string,
  ttlMs?: number,
): PairingCodeRecord {
  const resolvedTtlMs = resolveTtlMs(ttlMs, REGISTER_PAIRING_CODE_TTL_MS)
  pruneExpired()
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error('pairing code must be 6 digits')
  }
  const record: PairingCodeRecord = {
    locationId,
    code: trimmed,
    expiresAtMs: Date.now() + resolvedTtlMs,
  }
  store.set(storageKey(locationId, trimmed), record)
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
  if (record.expiresAtMs <= Date.now()) {
    store.delete(key)
    return false
  }
  store.delete(key)
  return true
}

/** Clear all in-memory pairing codes (tests). */
export function clearPairingCodes(): void {
  store.clear()
}
