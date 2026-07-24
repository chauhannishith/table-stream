import { api, type HubApiClient } from './api-client'

export type HubStatusValue = 'ACTIVE' | 'SUSPENDED'

export type HubStatus = {
  hub_status: HubStatusValue
  location_name: string
  schema_version: string
  db_ready: boolean
  cloud_sync_enabled: boolean
  org_id: string
  location_id: string
  hub_id: string
  subscription_status: string
}

/** True when hub writes should be treated as blocked. */
export function isHubSuspended(status: Pick<HubStatus, 'hub_status'>): boolean {
  return status.hub_status === 'SUSPENDED'
}

/** Load hub identity and subscription gate (no auth required on hub). */
export async function fetchHubStatus(
  client: HubApiClient = api,
): Promise<HubStatus> {
  return client.get<HubStatus>('/v1/status', {
    deviceToken: null,
    staffToken: null,
  })
}
