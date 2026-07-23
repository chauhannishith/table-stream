import type { DeviceType } from '@table-stream/shared-types/domain'

export const DEVICE_TYPE_STORAGE_KEY = 'ts.device_type'

const DEVICE_HOME_PATH: Record<DeviceType, string> = {
  COUNTER: '/counter',
  WAITER: '/waiter',
  KITCHEN: '/kitchen',
  CUSTOMER: '/customer',
}

const DEVICE_TYPES = new Set<string>(Object.keys(DEVICE_HOME_PATH))

/** Map hub device_type to the role home route. */
export function pathForDeviceType(deviceType: DeviceType): string {
  return DEVICE_HOME_PATH[deviceType]
}

/** Default home when device_type is missing or unknown (counter-first MVP). */
export function defaultHomePath(): string {
  return DEVICE_HOME_PATH.COUNTER
}

/** Read device_type from localStorage; null when unset or invalid. */
export function getStoredDeviceType(): DeviceType | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(DEVICE_TYPE_STORAGE_KEY)
  if (!raw || !DEVICE_TYPES.has(raw)) return null
  return raw as DeviceType
}

/** Persist device_type after pairing (F0.3 will call this). */
export function setStoredDeviceType(deviceType: DeviceType): void {
  localStorage.setItem(DEVICE_TYPE_STORAGE_KEY, deviceType)
}

/** Resolve the app entry path from stored device_type. */
export function resolveHomePath(): string {
  const deviceType = getStoredDeviceType()
  if (!deviceType) return defaultHomePath()
  return pathForDeviceType(deviceType)
}
