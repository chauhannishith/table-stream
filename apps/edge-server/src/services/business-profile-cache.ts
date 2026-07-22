import type { HubConfig } from '../config.js'
import { loadSubscriptionEnv } from '../config.js'
import type { HubDb } from '../db/client.js'
import {
  getBusinessProfileCache,
  isBusinessProfileCacheStale,
  type BusinessProfilePayload,
  upsertBusinessProfileCache,
} from '../repositories/business-profile.js'
import {
  fetchEntitlementFromControlPlane,
  isSubscriptionActive,
  type EntitlementSnapshot,
} from './license-checker.js'

export type { BusinessProfilePayload } from '../repositories/business-profile.js'

export const BUSINESS_PROFILE_CACHE_TTL_MS = 15 * 60 * 1000

type FetchLike = typeof fetch

function hasEnvEntitlementOverride(): boolean {
  return (
    process.env.HUB_ENTITLED !== undefined ||
    process.env.SUBSCRIPTION_STATUS !== undefined ||
    process.env.SUBSCRIPTION_PERIOD_END !== undefined
  )
}

function hasEnvBusinessProfileOverride(): boolean {
  return (
    process.env.ORG_LEGAL_NAME !== undefined ||
    process.env.ORG_GST_NUMBER !== undefined ||
    process.env.ORG_PHONE !== undefined
  )
}

/** Build business header fields from ORG_* env vars (dev/offline demo). */
export function resolveBusinessProfileFromEnv(): BusinessProfilePayload {
  const env = loadSubscriptionEnv()
  return {
    legal_name: env.orgLegalName ?? 'Unknown Business',
    trade_name: null,
    gst_number: env.orgGstNumber ?? '',
    address_lines: {},
    phone: env.orgPhone ?? '',
    email: null,
  }
}

/** Persist business profile payload into hub_business_profile_cache. */
export function refreshBusinessProfileCache(
  db: HubDb,
  orgId: string,
  profile: BusinessProfilePayload,
  now = new Date(),
): void {
  const fetchedAt = now.toISOString().replace('T', ' ').slice(0, 19)
  const expiresAt = new Date(now.getTime() + BUSINESS_PROFILE_CACHE_TTL_MS)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)

  upsertBusinessProfileCache(db, {
    orgId,
    legalName: profile.legal_name,
    tradeName: profile.trade_name,
    gstNumber: profile.gst_number,
    addressLinesJson: JSON.stringify(profile.address_lines),
    phone: profile.phone,
    email: profile.email,
    logoPath: null,
    fetchedAt,
    expiresAt,
  })
}

/** Update cache when hub is ACTIVE and a profile payload is available. */
export function refreshBusinessProfileIfActive(
  db: HubDb,
  config: HubConfig,
  active: boolean,
  profile: BusinessProfilePayload | null | undefined,
  now = new Date(),
): void {
  if (!active || !profile) return
  refreshBusinessProfileCache(db, config.org_id, profile, now)
}

function resolveProfileForRefresh(
  entitlement: EntitlementSnapshot,
): BusinessProfilePayload | null {
  if (hasEnvEntitlementOverride() || hasEnvBusinessProfileOverride()) {
    return resolveBusinessProfileFromEnv()
  }

  return entitlement.businessProfile ?? null
}

/** Refresh hub_business_profile_cache after a successful license check. */
export function refreshBusinessProfileFromEntitlement(
  db: HubDb,
  config: HubConfig,
  active: boolean,
  entitlement: EntitlementSnapshot,
  now = new Date(),
): void {
  refreshBusinessProfileIfActive(
    db,
    config,
    active,
    resolveProfileForRefresh(entitlement),
    now,
  )
}

/** Re-fetch business profile when cache is stale (e.g. before invoice issue). */
export async function ensureBusinessProfileCache(
  db: HubDb,
  config: HubConfig,
  options: {
    fetchImpl?: FetchLike
    now?: Date
  } = {},
): Promise<void> {
  const now = options.now ?? new Date()
  const cached = getBusinessProfileCache(db, config.org_id)
  if (cached && !isBusinessProfileCacheStale(cached.expiresAt)) {
    return
  }

  if (hasEnvEntitlementOverride() || hasEnvBusinessProfileOverride()) {
    refreshBusinessProfileCache(
      db,
      config.org_id,
      resolveBusinessProfileFromEnv(),
      now,
    )
    return
  }

  try {
    const entitlement = await fetchEntitlementFromControlPlane(
      config,
      options.fetchImpl,
    )
    if (
      isSubscriptionActive(entitlement, now) &&
      entitlement.businessProfile
    ) {
      refreshBusinessProfileCache(
        db,
        config.org_id,
        entitlement.businessProfile,
        now,
      )
    }
  } catch {
    // Keep stale cache; invoice read path falls back to env defaults.
  }
}
