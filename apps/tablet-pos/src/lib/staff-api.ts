import type { StaffRole } from '@table-stream/shared-types/domain'
import { api, type HubApiClient } from './api-client'

export type Staff = {
  id: string
  location_id: string
  name: string
  role: StaffRole
  assigned_zone_ids: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StaffWriteInput = {
  name?: string
  role?: StaffRole
  pin?: string
  assigned_zone_ids?: string[]
  is_active?: boolean
}

export const STAFF_ROLES: StaffRole[] = ['ADMIN', 'COUNTER', 'WAITER']

/** Validate a staff PIN for create/reset (digits only, hub hashes server-side). */
export function validateStaffPin(pin: string): string {
  const trimmed = pin.trim()
  if (!trimmed) {
    throw new Error('PIN is required')
  }
  if (!/^\d{4,8}$/.test(trimmed)) {
    throw new Error('PIN must be 4–8 digits')
  }
  return trimmed
}

/** Parse a role string; rejects unknown values. */
export function parseStaffRole(role: string): StaffRole {
  if (role === 'ADMIN' || role === 'COUNTER' || role === 'WAITER') {
    return role
  }
  throw new Error('Invalid staff role')
}

/** List staff (include inactive for setup reactivation). */
export async function listStaff(
  client: HubApiClient = api,
): Promise<Staff[]> {
  const result = await client.get<{ staff: Staff[] }>(
    '/v1/staff?include_inactive=true',
  )
  return result.staff
}

/** Create staff with PIN (response never includes pin_hash). */
export async function createStaff(
  input: {
    name: string
    role: StaffRole
    pin: string
  },
  client: HubApiClient = api,
): Promise<Staff> {
  const result = await client.post<{ staff: Staff }>('/v1/staff', {
    body: {
      name: input.name.trim(),
      role: input.role,
      pin: validateStaffPin(input.pin),
    },
  })
  return result.staff
}

/** Patch staff fields (rename, role, PIN reset, activate/deactivate). */
export async function updateStaff(
  id: string,
  input: StaffWriteInput,
  client: HubApiClient = api,
): Promise<Staff> {
  const body: StaffWriteInput = {}
  if (input.name !== undefined) body.name = input.name.trim()
  if (input.role !== undefined) body.role = input.role
  if (input.pin !== undefined) body.pin = validateStaffPin(input.pin)
  if (input.assigned_zone_ids !== undefined) {
    body.assigned_zone_ids = input.assigned_zone_ids
  }
  if (input.is_active !== undefined) body.is_active = input.is_active

  const result = await client.patch<{ staff: Staff }>(`/v1/staff/${id}`, {
    body,
  })
  return result.staff
}
