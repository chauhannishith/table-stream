import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HubApiError,
  buildAuthHeaders,
  createHubApiClient,
  parseHubProblem,
} from './api-client'
import {
  setDeviceToken,
  setStaffToken,
} from './auth-storage'

function installMemorySessionStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
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

describe('parseHubProblem', () => {
  it('parses hub problem JSON', () => {
    expect(
      parseHubProblem(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid device token',
            details: { reason: 'expired' },
          },
        },
        401,
      ),
    ).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Invalid device token',
      details: { reason: 'expired' },
    })
  })

  it('falls back for non-problem bodies', () => {
    expect(parseHubProblem({ oops: true }, 500)).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Request failed (500)',
      details: {},
    })
  })
})

describe('buildAuthHeaders', () => {
  beforeEach(() => {
    installMemorySessionStorage()
  })

  it('injects device and staff tokens from session storage', () => {
    setDeviceToken('dev_abc')
    setStaffToken('staff_xyz')

    expect(buildAuthHeaders()).toEqual({
      Accept: 'application/json',
      'X-Device-Token': 'dev_abc',
      'X-Staff-Token': 'staff_xyz',
    })
  })

  it('allows explicit token overrides and omission', () => {
    setDeviceToken('stored_device')
    setStaffToken('stored_staff')

    expect(
      buildAuthHeaders({
        deviceToken: 'override_device',
        staffToken: null,
      }),
    ).toEqual({
      Accept: 'application/json',
      'X-Device-Token': 'override_device',
    })
  })
})

describe('createHubApiClient', () => {
  beforeEach(() => {
    installMemorySessionStorage()
  })

  it('GETs JSON from hub base URL with auth headers', async () => {
    setDeviceToken('dev_token')
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:8443/v1/status')
      expect(init?.method).toBe('GET')
      expect(new Headers(init?.headers).get('X-Device-Token')).toBe('dev_token')
      return new Response(JSON.stringify({ hub_status: 'ACTIVE' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const client = createHubApiClient(fetchImpl)
    await expect(client.get<{ hub_status: string }>('/v1/status')).resolves.toEqual({
      hub_status: 'ACTIVE',
    })
  })

  it('POSTs JSON body and throws HubApiError on problem response', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(JSON.stringify({ code: '123456' }))
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid pairing code',
            details: {},
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    })

    const client = createHubApiClient(fetchImpl)
    await expect(
      client.post('/v1/devices/pair', { body: { code: '123456' } }),
    ).rejects.toMatchObject({
      name: 'HubApiError',
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'Invalid pairing code',
    } satisfies Partial<HubApiError>)
  })
})
