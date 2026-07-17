import type { HubDb } from '../db/client.js'
import { AppError } from './errors.js'
import { getLocationById } from '../repositories/locations.js'

/** Resolve hub status from location row and HUB_ENTITLED env override. */
export function getEffectiveHubStatus(
  db: HubDb,
  locationId: string,
): 'ACTIVE' | 'SUSPENDED' {
  const entitled = process.env.HUB_ENTITLED !== 'false'
  if (!entitled) return 'SUSPENDED'

  const location = getLocationById(db, locationId)
  if (location?.hubStatus === 'SUSPENDED') return 'SUSPENDED'

  return 'ACTIVE'
}

/** Reject mutating operations when the hub is suspended (subscription lapsed). */
export function assertHubWritable(db: HubDb, locationId: string): void {
  if (getEffectiveHubStatus(db, locationId) === 'SUSPENDED') {
    throw new AppError('FORBIDDEN', 'Hub is suspended', 403, {
      hub_status: 'SUSPENDED',
    })
  }
}
