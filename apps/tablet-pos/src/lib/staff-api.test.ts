import { describe, expect, it, vi } from 'vitest'
import type { HubApiClient } from './api-client'
import {
  createStaff,
  listStaff,
  parseStaffRole,
  updateStaff,
  validateStaffPin,
} from './staff-api'

describe('staff helpers', () => {
  it('validates PIN length and digits', () => {
    expect(validateStaffPin('1234')).toBe('1234')
    expect(validateStaffPin(' 567890 ')).toBe('567890')
    expect(() => validateStaffPin('')).toThrow(/required/)
    expect(() => validateStaffPin('12')).toThrow(/4–8 digits/)
    expect(() => validateStaffPin('abcd')).toThrow(/4–8 digits/)
  })

  it('parses known staff roles', () => {
    expect(parseStaffRole('ADMIN')).toBe('ADMIN')
    expect(parseStaffRole('WAITER')).toBe('WAITER')
    expect(() => parseStaffRole('KITCHEN')).toThrow(/Invalid staff role/)
  })
})

describe('staff API helpers', () => {
  it('lists staff with include_inactive', async () => {
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
            created_at: '2026-07-24T00:00:00.000Z',
            updated_at: '2026-07-24T00:00:00.000Z',
          },
        ],
      })),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(listStaff(client)).resolves.toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith(
      '/v1/staff?include_inactive=true',
    )
  })

  it('creates and updates staff without exposing pin_hash', async () => {
    const member = {
      id: 'st_1',
      location_id: 'loc',
      name: 'Alex',
      role: 'WAITER' as const,
      assigned_zone_ids: [],
      is_active: true,
      created_at: '2026-07-24T00:00:00.000Z',
      updated_at: '2026-07-24T00:00:00.000Z',
    }
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ staff: member })),
      patch: vi.fn(async () => ({
        staff: { ...member, name: 'Alex W', role: 'ADMIN', is_active: false },
      })),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    const created = await createStaff(
      { name: 'Alex', role: 'WAITER', pin: '1234' },
      client,
    )
    expect(created).toEqual(member)
    expect(created).not.toHaveProperty('pin_hash')
    expect(client.post).toHaveBeenCalledWith('/v1/staff', {
      body: { name: 'Alex', role: 'WAITER', pin: '1234' },
    })

    await expect(
      updateStaff(
        'st_1',
        { name: 'Alex W', role: 'ADMIN', is_active: false },
        client,
      ),
    ).resolves.toMatchObject({
      name: 'Alex W',
      role: 'ADMIN',
      is_active: false,
    })
  })
})
