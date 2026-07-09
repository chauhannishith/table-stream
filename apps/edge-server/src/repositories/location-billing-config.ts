import { eq } from 'drizzle-orm'
import { locationBillingConfig } from '@table-stream/shared-types/hub'
import type { PriceTaxMode } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type LocationBillingConfigRow = typeof locationBillingConfig.$inferSelect

export function getLocationBillingConfig(
  db: HubDb,
  locationId: string,
): LocationBillingConfigRow | undefined {
  return db
    .select()
    .from(locationBillingConfig)
    .where(eq(locationBillingConfig.locationId, locationId))
    .get()
}

export type UpsertLocationBillingConfigInput = {
  taxRulesJson?: string
  priceTaxMode?: PriceTaxMode
  serviceChargeRulesJson?: string
  tipQuickActionsJson?: string
}

export function upsertLocationBillingConfig(
  db: HubDb,
  locationId: string,
  input: UpsertLocationBillingConfigInput,
): LocationBillingConfigRow {
  const existing = getLocationBillingConfig(db, locationId)
  const updatedAt = nowSqliteTimestamp()

  if (!existing) {
    db.insert(locationBillingConfig)
      .values({
        locationId,
        taxRulesJson: input.taxRulesJson ?? '{}',
        priceTaxMode: input.priceTaxMode ?? 'EXCLUSIVE',
        serviceChargeRulesJson: input.serviceChargeRulesJson ?? '{}',
        tipQuickActionsJson: input.tipQuickActionsJson ?? '[]',
        updatedAt,
      })
      .run()
  } else {
    const patch: Partial<typeof locationBillingConfig.$inferInsert> = {
      updatedAt,
    }
    if (input.taxRulesJson !== undefined) patch.taxRulesJson = input.taxRulesJson
    if (input.priceTaxMode !== undefined) patch.priceTaxMode = input.priceTaxMode
    if (input.serviceChargeRulesJson !== undefined) {
      patch.serviceChargeRulesJson = input.serviceChargeRulesJson
    }
    if (input.tipQuickActionsJson !== undefined) {
      patch.tipQuickActionsJson = input.tipQuickActionsJson
    }

    db.update(locationBillingConfig)
      .set(patch)
      .where(eq(locationBillingConfig.locationId, locationId))
      .run()
  }

  const row = getLocationBillingConfig(db, locationId)
  if (!row) {
    throw new Error(`Billing config upsert failed for ${locationId}`)
  }
  return row
}
