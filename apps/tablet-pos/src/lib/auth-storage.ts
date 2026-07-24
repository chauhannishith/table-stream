export const DEVICE_TOKEN_STORAGE_KEY = 'ts.device_token'
export const STAFF_TOKEN_STORAGE_KEY = 'ts.staff_token'
export const STAFF_SESSION_STORAGE_KEY = 'ts.staff_session'

export type StoredStaffSession = {
  id: string
  location_id: string
  name: string
  role: string
  assigned_zone_ids: string[]
  is_active: boolean
  expires_at: string
}

function readSession(key: string): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(key)
}

function writeSession(key: string, value: string | null): void {
  if (value === null) {
    sessionStorage.removeItem(key)
    return
  }
  sessionStorage.setItem(key, value)
}

/** Device token from pairing (X-Device-Token). */
export function getDeviceToken(): string | null {
  return readSession(DEVICE_TOKEN_STORAGE_KEY)
}

export function setDeviceToken(token: string | null): void {
  writeSession(DEVICE_TOKEN_STORAGE_KEY, token)
}

/** Staff session token from PIN login (X-Staff-Token). */
export function getStaffToken(): string | null {
  return readSession(STAFF_TOKEN_STORAGE_KEY)
}

export function setStaffToken(token: string | null): void {
  writeSession(STAFF_TOKEN_STORAGE_KEY, token)
}

/** Cached staff DTO + session expiry from last successful login. */
export function getStoredStaffSession(): StoredStaffSession | null {
  const raw = readSession(STAFF_SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredStaffSession
  } catch {
    return null
  }
}

export function setStoredStaffSession(session: StoredStaffSession | null): void {
  if (session === null) {
    writeSession(STAFF_SESSION_STORAGE_KEY, null)
    return
  }
  writeSession(STAFF_SESSION_STORAGE_KEY, JSON.stringify(session))
}

/** Clear staff token and cached staff session. */
export function clearStaffSession(): void {
  setStaffToken(null)
  setStoredStaffSession(null)
}
