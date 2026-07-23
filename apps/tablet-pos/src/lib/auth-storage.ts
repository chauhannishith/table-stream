export const DEVICE_TOKEN_STORAGE_KEY = 'ts.device_token'
export const STAFF_TOKEN_STORAGE_KEY = 'ts.staff_token'

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
