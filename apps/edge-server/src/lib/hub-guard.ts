import type { HubDb } from '../db/client.js'
import { AppError } from './errors.js'
import { getLocationById } from '../repositories/locations.js'

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

export function assertHubWritable(db: HubDb, locationId: string): void {
  if (getEffectiveHubStatus(db, locationId) === 'SUSPENDED') {
    throw new AppError('FORBIDDEN', 'Hub is suspended', 403, {
      hub_status: 'SUSPENDED',
    })
  }
}
