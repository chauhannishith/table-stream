import type { HubConfig } from '../config.js'
import type { HubDb } from '../db/client.js'
import { upsertOrganization } from '../repositories/organizations.js'
import {
  getLocationById,
  upsertLocation,
} from '../repositories/locations.js'

export type HubIdentity = {
  org_id: string
  location_id: string
  hub_id: string
  location_name: string
  timezone: string
  hub_status: string
  cloud_sync_enabled: boolean
}

export function seedHubFromConfig(db: HubDb, config: HubConfig): void {
  const orgName =
    process.env.ORG_LEGAL_NAME?.trim() || config.location_name

  upsertOrganization(db, {
    id: config.org_id,
    name: orgName,
  })

  upsertLocation(db, {
    id: config.location_id,
    orgId: config.org_id,
    name: config.location_name,
    timezone: config.timezone,
    hubId: config.hub_id,
    cloudSyncEnabled: config.cloud_sync_enabled,
  })
}

export function getHubIdentity(
  db: HubDb,
  config: HubConfig,
): HubIdentity | null {
  const location = getLocationById(db, config.location_id)
  if (!location) return null

  return {
    org_id: location.orgId,
    location_id: location.id,
    hub_id: location.hubId,
    location_name: location.name,
    timezone: location.timezone,
    hub_status: location.hubStatus,
    cloud_sync_enabled: location.cloudSyncEnabled,
  }
}
