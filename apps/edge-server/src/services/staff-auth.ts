import type { HubDb } from '../db/client.js'
import { verifyPin } from '../lib/auth.js'
import { AppError } from '../lib/errors.js'
import {
  clearStaffPinFailures,
  getStaffLockoutUntilMs,
  isStaffLockedOut,
  recordStaffPinFailure,
} from '../lib/staff-lockout.js'
import { createStaffSession } from '../lib/staff-sessions.js'
import { getStaffById } from '../repositories/staff.js'
import { toStaffDto } from './floor-setup-dto.js'

export type StaffLoginInput = {
  staffId: string
  pin: string
}

/**
 * Authenticate staff by PIN and issue a session token.
 * Lockout after repeated failures; inactive staff cannot log in.
 * @throws {AppError} UNAUTHORIZED for bad PIN; FORBIDDEN when locked out; NOT_FOUND
 */
export function loginStaff(
  db: HubDb,
  locationId: string,
  input: StaffLoginInput,
) {
  const staffId = input.staffId.trim()
  const pin = input.pin.trim()

  if (!staffId || !pin) {
    throw new AppError(
      'VALIDATION_ERROR',
      'staff_id and pin are required',
      400,
    )
  }

  if (!/^\d{4,6}$/.test(pin)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'pin must be 4–6 digits',
      400,
    )
  }

  const staff = getStaffById(db, locationId, staffId)
  if (!staff || !staff.isActive) {
    throw new AppError('NOT_FOUND', 'Staff not found', 404, {
      staff_id: staffId,
    })
  }

  if (isStaffLockedOut(locationId, staffId)) {
    const lockedUntilMs = getStaffLockoutUntilMs(locationId, staffId)
    throw new AppError(
      'FORBIDDEN',
      'Staff PIN locked due to too many failures',
      403,
      {
        staff_id: staffId,
        locked_until: lockedUntilMs
          ? new Date(lockedUntilMs).toISOString()
          : null,
      },
    )
  }

  if (!verifyPin(pin, staff.pinHash)) {
    const result = recordStaffPinFailure(locationId, staffId)
    if (result.locked) {
      throw new AppError(
        'FORBIDDEN',
        'Staff PIN locked due to too many failures',
        403,
        {
          staff_id: staffId,
          locked_until: result.lockedUntilMs
            ? new Date(result.lockedUntilMs).toISOString()
            : null,
        },
      )
    }

    throw new AppError('UNAUTHORIZED', 'Invalid PIN', 401, {
      staff_id: staffId,
      failures: result.failures,
    })
  }

  clearStaffPinFailures(locationId, staffId)
  const { token, session } = createStaffSession({
    locationId,
    staffId: staff.id,
    role: staff.role,
  })

  return {
    staff: toStaffDto(staff),
    session_token: token,
    expires_at: new Date(session.expiresAtMs).toISOString(),
  }
}
