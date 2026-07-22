import type { HubConfig } from '../config.js'
import { loadSubscriptionEnv } from '../config.js'
import type { HubDb } from '../db/client.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'
import {
  getLocationById,
  updateLocationLicenseStatus,
} from '../repositories/locations.js'
import type { BusinessProfilePayload } from './business-profile-cache.js'
import { parseBusinessProfilePayload } from '../repositories/business-profile.js'

export type EntitlementSnapshot = {
  enabled: boolean
  subscriptionStatus: string
  currentPeriodEnd: string | null
  source: 'env' | 'control_plane'
  businessProfile?: BusinessProfilePayload | null
}

type FetchLike = typeof fetch

function hasEnvEntitlementOverride(): boolean {
  return (
    process.env.HUB_ENTITLED !== undefined ||
    process.env.SUBSCRIPTION_STATUS !== undefined ||
    process.env.SUBSCRIPTION_PERIOD_END !== undefined
  )
}

/** Read subscription entitlement from HUB_ENTITLED / SUBSCRIPTION_* env vars. */
export function resolveEntitlementFromEnv(): EntitlementSnapshot {
  const env = loadSubscriptionEnv()
  return {
    enabled: env.entitled,
    subscriptionStatus: env.status,
    currentPeriodEnd: env.periodEnd,
    source: 'env',
  }
}

/** Return true when enabled, status is current, and period end has not passed. */
export function isSubscriptionActive(
  snapshot: EntitlementSnapshot,
  now = new Date(),
): boolean {
  if (!snapshot.enabled) return false
  if (
    snapshot.subscriptionStatus === 'SUSPENDED' ||
    snapshot.subscriptionStatus === 'CANCELLED' ||
    snapshot.subscriptionStatus === 'PAST_DUE'
  ) {
    return false
  }

  if (snapshot.currentPeriodEnd) {
    const periodEnd = Date.parse(snapshot.currentPeriodEnd)
    if (!Number.isNaN(periodEnd) && now.getTime() > periodEnd) {
      return false
    }
  }

  return true
}

/** Fetch org entitlement from the control plane API. */
export async function fetchEntitlementFromControlPlane(
  config: HubConfig,
  fetchImpl: FetchLike = fetch,
): Promise<EntitlementSnapshot> {
  const url = new URL(
    `/v1/orgs/${config.org_id}/entitlement`,
    config.control_plane.url,
  )
  url.searchParams.set('hub_id', config.hub_id)

  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `Control plane entitlement check failed with status ${response.status}`,
    )
  }

  const body = (await response.json()) as {
    enabled?: boolean
    subscription_status?: string
    current_period_end?: string | null
    business_profile?: unknown
  }

  return {
    enabled: body.enabled ?? false,
    subscriptionStatus: body.subscription_status ?? 'SUSPENDED',
    currentPeriodEnd: body.current_period_end ?? null,
    source: 'control_plane',
    businessProfile: parseBusinessProfilePayload(body.business_profile),
  }
}

export async function resolveEntitlement(
  config: HubConfig,
  fetchImpl: FetchLike = fetch,
): Promise<EntitlementSnapshot> {
  if (hasEnvEntitlementOverride()) {
    return resolveEntitlementFromEnv()
  }

  return fetchEntitlementFromControlPlane(config, fetchImpl)
}

/** Poll entitlement and persist hub_status on the location row. */
export async function runLicenseCheck(
  db: HubDb,
  config: HubConfig,
  options: {
    fetchImpl?: FetchLike
    now?: Date
  } = {},
): Promise<{
  hub_status: 'ACTIVE' | 'SUSPENDED'
  entitlement: EntitlementSnapshot
}> {
  const now = options.now ?? new Date()
  const checkedAt = nowSqliteTimestamp()
  const location = getLocationById(db, config.location_id)

  if (!location) {
    throw new Error(`Location not found: ${config.location_id}`)
  }

  let entitlement: EntitlementSnapshot
  try {
    entitlement = await resolveEntitlement(config, options.fetchImpl)
  } catch {
    return {
      hub_status: location.hubStatus as 'ACTIVE' | 'SUSPENDED',
      entitlement: {
        enabled: location.hubStatus === 'ACTIVE',
        subscriptionStatus: location.hubStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
        currentPeriodEnd: null,
        source: 'control_plane',
      },
    }
  }

  const active = isSubscriptionActive(entitlement, now)
  const hubStatus = active ? 'ACTIVE' : 'SUSPENDED'
  const suspendedAt =
    hubStatus === 'SUSPENDED'
      ? (location.suspendedAt ?? checkedAt)
      : null

  updateLocationLicenseStatus(db, config.location_id, {
    hubStatus,
    licenseLastCheckedAt: checkedAt,
    suspendedAt,
  })

  const { refreshBusinessProfileFromEntitlement } = await import(
    './business-profile-cache.js'
  )
  refreshBusinessProfileFromEntitlement(db, config, active, entitlement, now)

  return { hub_status: hubStatus, entitlement }
}
