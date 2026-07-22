import { eq } from 'drizzle-orm'
import { hubBusinessProfileCache } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { loadSubscriptionEnv } from '../config.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type BusinessProfilePayload = {
  legal_name: string
  trade_name: string | null
  gst_number: string
  address_lines: Record<string, unknown>
  phone: string
  email: string | null
}

/** Parse business_profile from control plane entitlement JSON. */
export function parseBusinessProfilePayload(
  raw: unknown,
): BusinessProfilePayload | null {
  if (!raw || typeof raw !== 'object') return null

  const profile = raw as Record<string, unknown>
  if (typeof profile.legal_name !== 'string') return null

  const addressRaw = profile.address_lines ?? profile.address_lines_json
  const addressLines =
    addressRaw && typeof addressRaw === 'object'
      ? (addressRaw as Record<string, unknown>)
      : {}

  return {
    legal_name: profile.legal_name,
    trade_name:
      typeof profile.trade_name === 'string' ? profile.trade_name : null,
    gst_number: typeof profile.gst_number === 'string' ? profile.gst_number : '',
    address_lines: addressLines,
    phone: typeof profile.phone === 'string' ? profile.phone : '',
    email: typeof profile.email === 'string' ? profile.email : null,
  }
}

export type BusinessProfileCacheRow = typeof hubBusinessProfileCache.$inferSelect

export type BusinessProfileSnapshot = {
  legal_name: string
  trade_name: string | null
  gst_number: string
  address_lines: Record<string, unknown>
  phone: string
  email: string | null
  logo_path: string | null
}

export function getBusinessProfileCache(
  db: HubDb,
  orgId: string,
): BusinessProfileCacheRow | undefined {
  return db
    .select()
    .from(hubBusinessProfileCache)
    .where(eq(hubBusinessProfileCache.orgId, orgId))
    .get()
}

/** True when cache row is missing or past expires_at. */
export function isBusinessProfileCacheStale(
  expiresAt: string,
  now = nowSqliteTimestamp(),
): boolean {
  return expiresAt <= now
}

export function upsertBusinessProfileCache(
  db: HubDb,
  input: {
    orgId: string
    legalName: string
    tradeName: string | null
    gstNumber: string
    addressLinesJson: string
    phone: string
    email: string | null
    logoPath: string | null
    fetchedAt: string
    expiresAt: string
  },
): BusinessProfileCacheRow {
  db.insert(hubBusinessProfileCache)
    .values({
      orgId: input.orgId,
      legalName: input.legalName,
      tradeName: input.tradeName,
      gstNumber: input.gstNumber,
      addressLinesJson: input.addressLinesJson,
      phone: input.phone,
      email: input.email,
      logoPath: input.logoPath,
      fetchedAt: input.fetchedAt,
      expiresAt: input.expiresAt,
    })
    .onConflictDoUpdate({
      target: hubBusinessProfileCache.orgId,
      set: {
        legalName: input.legalName,
        tradeName: input.tradeName,
        gstNumber: input.gstNumber,
        addressLinesJson: input.addressLinesJson,
        phone: input.phone,
        email: input.email,
        logoPath: input.logoPath,
        fetchedAt: input.fetchedAt,
        expiresAt: input.expiresAt,
      },
    })
    .run()

  const row = getBusinessProfileCache(db, input.orgId)
  if (!row) {
    throw new Error(`Business profile cache upsert failed for ${input.orgId}`)
  }
  return row
}

/** Load business header from hub cache, falling back to subscription env defaults. */
export function getBusinessProfileSnapshot(
  db: HubDb,
  orgId: string,
): BusinessProfileSnapshot {
  const cached = getBusinessProfileCache(db, orgId)

  if (cached) {
    return {
      legal_name: cached.legalName,
      trade_name: cached.tradeName,
      gst_number: cached.gstNumber,
      address_lines: JSON.parse(cached.addressLinesJson) as Record<
        string,
        unknown
      >,
      phone: cached.phone,
      email: cached.email,
      logo_path: cached.logoPath,
    }
  }

  const env = loadSubscriptionEnv()
  return {
    legal_name: env.orgLegalName ?? 'Unknown Business',
    trade_name: null,
    gst_number: env.orgGstNumber ?? '',
    address_lines: {},
    phone: env.orgPhone ?? '',
    email: null,
    logo_path: null,
  }
}
