import type { StaffRole } from '@table-stream/shared-types/domain'
import { api, HubApiError, type HubApiClient } from './api-client'
import {
  setStaffToken,
  setStoredStaffSession,
  type StoredStaffSession,
} from './auth-storage'
import { getStoredDeviceType } from './device-type'

export type StaffMember = {
  id: string
  location_id: string
  name: string
  role: StaffRole
  assigned_zone_ids: string[]
  is_active: boolean
}

export type StaffLoginResponse = {
  staff: StaffMember
  session_token: string
  expires_at: string
}

export type StaffLoginInput = {
  staffId: string
  pin: string
}

/** Counter/waiter need a staff session; kitchen/customer displays do not. */
export function deviceRequiresStaffLogin(): boolean {
  const deviceType = getStoredDeviceType()
  return deviceType === 'COUNTER' || deviceType === 'WAITER' || deviceType === null
}

/** Format hub login errors for the PIN screen (includes lockout / failure hints). */
export function formatStaffLoginError(err: unknown): string {
  if (err instanceof HubApiError) {
    if (err.code === 'FORBIDDEN') {
      const lockedUntil = err.details.locked_until
      if (typeof lockedUntil === 'string' && lockedUntil) {
        return `${err.message} (until ${lockedUntil})`
      }
      return err.message
    }
    if (err.code === 'UNAUTHORIZED') {
      const failures = err.details.failures
      if (typeof failures === 'number') {
        return `${err.message} (${failures} failed attempt${failures === 1 ? '' : 's'})`
      }
      return err.message
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Login failed'
}

/** Load active staff for the PIN picker (device token required). */
export async function listStaffForLogin(
  client: HubApiClient = api,
): Promise<StaffMember[]> {
  const result = await client.get<{ staff: StaffMember[] }>('/v1/staff')
  return result.staff.filter((member) => member.is_active)
}

/** Authenticate with PIN and persist session_token + staff snapshot. */
export async function loginAndStoreStaff(
  input: StaffLoginInput,
  client: HubApiClient = api,
): Promise<StaffLoginResponse> {
  const result = await client.post<StaffLoginResponse>('/v1/auth/staff/login', {
    body: {
      staff_id: input.staffId.trim(),
      pin: input.pin.trim(),
    },
    staffToken: null,
  })

  const session: StoredStaffSession = {
    id: result.staff.id,
    location_id: result.staff.location_id,
    name: result.staff.name,
    role: result.staff.role,
    assigned_zone_ids: result.staff.assigned_zone_ids,
    is_active: result.staff.is_active,
    expires_at: result.expires_at,
  }

  setStaffToken(result.session_token)
  setStoredStaffSession(session)
  return result
}
