import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEVICE_TYPE_STORAGE_KEY,
  defaultHomePath,
  getStoredDeviceType,
  pathForDeviceType,
  resolveHomePath,
  setStoredDeviceType,
} from './device-type'

function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      clear: () => {
        store.clear()
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  })
}

describe('device-type routing', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
  })

  it('maps each device_type to its role route', () => {
    expect(pathForDeviceType('COUNTER')).toBe('/counter')
    expect(pathForDeviceType('WAITER')).toBe('/waiter')
    expect(pathForDeviceType('KITCHEN')).toBe('/kitchen')
    expect(pathForDeviceType('CUSTOMER')).toBe('/customer')
  })

  it('defaults home to counter when device_type is unset', () => {
    expect(getStoredDeviceType()).toBeNull()
    expect(resolveHomePath()).toBe('/counter')
    expect(defaultHomePath()).toBe('/counter')
  })

  it('reads and writes device_type in localStorage', () => {
    setStoredDeviceType('KITCHEN')
    expect(localStorage.getItem(DEVICE_TYPE_STORAGE_KEY)).toBe('KITCHEN')
    expect(getStoredDeviceType()).toBe('KITCHEN')
    expect(resolveHomePath()).toBe('/kitchen')
  })

  it('ignores invalid stored device_type values', () => {
    localStorage.setItem(DEVICE_TYPE_STORAGE_KEY, 'TABLET')
    expect(getStoredDeviceType()).toBeNull()
    expect(resolveHomePath()).toBe('/counter')
  })
})
