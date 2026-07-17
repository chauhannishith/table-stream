import { hashSessionToken, issueSessionToken } from './auth.js'

export type StaffSessionRecord = {
  locationId: string
  staffId: string
  role: string
  tokenHash: string
  expiresAtMs: number
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000
const byTokenHash = new Map<string, StaffSessionRecord>()

function pruneExpired(now = Date.now()): void {
  for (const [hash, session] of byTokenHash) {
    if (session.expiresAtMs <= now) byTokenHash.delete(hash)
  }
}

/** Create a staff session and return the plaintext token (shown once). */
export function createStaffSession(input: {
  locationId: string
  staffId: string
  role: string
  ttlMs?: number
}): { token: string; session: StaffSessionRecord } {
  pruneExpired()
  const token = issueSessionToken()
  const session: StaffSessionRecord = {
    locationId: input.locationId,
    staffId: input.staffId,
    role: input.role,
    tokenHash: hashSessionToken(token),
    expiresAtMs: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
  }
  byTokenHash.set(session.tokenHash, session)
  return { token, session }
}

/** Look up an active staff session by plaintext token. */
export function getStaffSessionByToken(
  token: string,
): StaffSessionRecord | undefined {
  pruneExpired()
  return byTokenHash.get(hashSessionToken(token.trim()))
}

/** Clear all in-memory staff sessions (tests). */
export function clearStaffSessions(): void {
  byTokenHash.clear()
}
