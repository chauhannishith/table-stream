import type { DeviceType } from '@table-stream/shared-types/domain'

export const DEVICE_TYPE_STORAGE_KEY = 'ts.device_type'

/** Role home paths — single source for AppRoutes and device_type redirect. */
export const ROLE_ROUTES = {
  COUNTER: '/counter',
  WAITER: '/waiter',
  KITCHEN: '/kitchen',
  CUSTOMER: '/customer',
} as const satisfies Record<DeviceType, `/${string}`>

/** Counter admin setup screens (Phase F1). */
export const COUNTER_SETUP_ZONES_PATH = `${ROLE_ROUTES.COUNTER}/setup/zones` as const

export type RolePath = (typeof ROLE_ROUTES)[DeviceType]

const DEVICE_TYPES = new Set<string>(Object.keys(ROLE_ROUTES))

/** Map hub device_type to the role home route. */
export function pathForDeviceType(deviceType: DeviceType): RolePath {
  return ROLE_ROUTES[deviceType]
}

/** Default home when device_type is missing or unknown (counter-first MVP). */
export function defaultHomePath(): RolePath {
  return ROLE_ROUTES.COUNTER
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
export function resolveHomePath(): RolePath {
  const deviceType = getStoredDeviceType()
  if (!deviceType) return defaultHomePath()
  return pathForDeviceType(deviceType)
}
