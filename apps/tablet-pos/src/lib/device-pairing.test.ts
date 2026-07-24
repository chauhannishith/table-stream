import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import { getDeviceToken } from './auth-storage'
import { DEVICE_TYPE_STORAGE_KEY, getStoredDeviceType } from './device-type'
import { pairAndStoreDevice } from './device-pairing'

function installMemoryStorage() {
  const session = new Map<string, string>()
  const local = new Map<string, string>()

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value)
      },
      clear: () => {
        session.clear()
      },
      removeItem: (key: string) => {
        session.delete(key)
      },
    },
  })

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => {
        local.set(key, value)
      },
      clear: () => {
        local.clear()
      },
      removeItem: (key: string) => {
        local.delete(key)
      },
    },
  })
}

describe('pairAndStoreDevice', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('stores device_token and device_type on success', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({
        device: {
          id: 'dev_1',
          location_id: 'loc_test',
          device_type: 'COUNTER' as const,
          name: 'Front counter',
          is_active: true,
        },
        device_token: 'tok_abc',
      })),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    const result = await pairAndStoreDevice(
      {
        pairingCode: '123456',
        deviceType: 'COUNTER',
        name: 'Front counter',
      },
      client,
    )

    expect(client.post).toHaveBeenCalledWith('/v1/devices/pair', {
      body: {
        pairing_code: '123456',
        device_type: 'COUNTER',
        name: 'Front counter',
      },
      deviceToken: null,
      staffToken: null,
    })
    expect(result.device_token).toBe('tok_abc')
    expect(getDeviceToken()).toBe('tok_abc')
    expect(getStoredDeviceType()).toBe('COUNTER')
    expect(localStorage.getItem(DEVICE_TYPE_STORAGE_KEY)).toBe('COUNTER')
  })

  it('does not store tokens when pairing fails', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired pairing code',
            details: {},
          },
          401,
        )
      }),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(
      pairAndStoreDevice(
        {
          pairingCode: '000000',
          deviceType: 'KITCHEN',
          name: 'KDS 1',
        },
        client,
      ),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    })

    expect(getDeviceToken()).toBeNull()
    expect(getStoredDeviceType()).toBeNull()
  })
})
