import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import {
  getStaffToken,
  getStoredStaffSession,
} from './auth-storage'
import {
  deviceRequiresStaffLogin,
  formatStaffLoginError,
  listStaffForLogin,
  loginAndStoreStaff,
} from './staff-login'
import { DEVICE_TYPE_STORAGE_KEY } from './device-type'

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

describe('staff login helpers', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('requires staff login for counter and waiter only', () => {
    expect(deviceRequiresStaffLogin()).toBe(true)

    localStorage.setItem(DEVICE_TYPE_STORAGE_KEY, 'COUNTER')
    expect(deviceRequiresStaffLogin()).toBe(true)

    localStorage.setItem(DEVICE_TYPE_STORAGE_KEY, 'WAITER')
    expect(deviceRequiresStaffLogin()).toBe(true)

    localStorage.setItem(DEVICE_TYPE_STORAGE_KEY, 'KITCHEN')
    expect(deviceRequiresStaffLogin()).toBe(false)

    localStorage.setItem(DEVICE_TYPE_STORAGE_KEY, 'CUSTOMER')
    expect(deviceRequiresStaffLogin()).toBe(false)
  })

  it('formats invalid PIN and lockout errors', () => {
    expect(
      formatStaffLoginError(
        new HubApiError(
          {
            code: 'UNAUTHORIZED',
            message: 'Invalid PIN',
            details: { failures: 2 },
          },
          401,
        ),
      ),
    ).toBe('Invalid PIN (2 failed attempts)')

    expect(
      formatStaffLoginError(
        new HubApiError(
          {
            code: 'FORBIDDEN',
            message: 'Staff PIN locked due to too many failures',
            details: { locked_until: '2026-07-24T12:00:00.000Z' },
          },
          403,
        ),
      ),
    ).toBe(
      'Staff PIN locked due to too many failures (until 2026-07-24T12:00:00.000Z)',
    )
  })

  it('lists only active staff', async () => {
    const client = {
      get: vi.fn(async () => ({
        staff: [
          {
            id: 'st_1',
            location_id: 'loc',
            name: 'Alex',
            role: 'WAITER',
            assigned_zone_ids: [],
            is_active: true,
          },
          {
            id: 'st_2',
            location_id: 'loc',
            name: 'Inactive',
            role: 'COUNTER',
            assigned_zone_ids: [],
            is_active: false,
          },
        ],
      })),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(listStaffForLogin(client)).resolves.toEqual([
      {
        id: 'st_1',
        location_id: 'loc',
        name: 'Alex',
        role: 'WAITER',
        assigned_zone_ids: [],
        is_active: true,
      },
    ])
  })

  it('stores session_token and staff snapshot on success', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({
        staff: {
          id: 'st_1',
          location_id: 'loc',
          name: 'Alex',
          role: 'ADMIN' as const,
          assigned_zone_ids: [],
          is_active: true,
        },
        session_token: 'sess_abc',
        expires_at: '2099-01-01T00:00:00.000Z',
      })),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    const result = await loginAndStoreStaff(
      { staffId: 'st_1', pin: '1234' },
      client,
    )

    expect(client.post).toHaveBeenCalledWith('/v1/auth/staff/login', {
      body: { staff_id: 'st_1', pin: '1234' },
      staffToken: null,
    })
    expect(result.session_token).toBe('sess_abc')
    expect(getStaffToken()).toBe('sess_abc')
    expect(getStoredStaffSession()).toEqual({
      id: 'st_1',
      location_id: 'loc',
      name: 'Alex',
      role: 'ADMIN',
      assigned_zone_ids: [],
      is_active: true,
      expires_at: '2099-01-01T00:00:00.000Z',
    })
  })

  it('does not store session when PIN is invalid', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'UNAUTHORIZED',
            message: 'Invalid PIN',
            details: { failures: 1 },
          },
          401,
        )
      }),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(
      loginAndStoreStaff({ staffId: 'st_1', pin: '0000' }, client),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })

    expect(getStaffToken()).toBeNull()
    expect(getStoredStaffSession()).toBeNull()
  })
})
