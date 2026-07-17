import { eq } from 'drizzle-orm'
import { hubBusinessProfileCache } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { loadSubscriptionEnv } from '../config.js'

export type BusinessProfileSnapshot = {
  legal_name: string
  trade_name: string | null
  gst_number: string
  address_lines: Record<string, unknown>
  phone: string
  email: string | null
  logo_path: string | null
}

export function getBusinessProfileSnapshot(
  db: HubDb,
  orgId: string,
): BusinessProfileSnapshot {
  const cached = db
    .select()
    .from(hubBusinessProfileCache)
    .where(eq(hubBusinessProfileCache.orgId, orgId))
    .get()

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
