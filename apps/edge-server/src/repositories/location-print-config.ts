import { eq } from 'drizzle-orm'
import { locationPrintConfig } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type LocationPrintConfigRow = typeof locationPrintConfig.$inferSelect

export function getLocationPrintConfig(
  db: HubDb,
  locationId: string,
): LocationPrintConfigRow | undefined {
  return db
    .select()
    .from(locationPrintConfig)
    .where(eq(locationPrintConfig.locationId, locationId))
    .get()
}

export type UpsertLocationPrintConfigInput = {
  printStagesJson?: string
}

export function upsertLocationPrintConfig(
  db: HubDb,
  locationId: string,
  input: UpsertLocationPrintConfigInput,
): LocationPrintConfigRow {
  const existing = getLocationPrintConfig(db, locationId)
  const updatedAt = nowSqliteTimestamp()

  if (!existing) {
    db.insert(locationPrintConfig)
      .values({
        locationId,
        printStagesJson: input.printStagesJson ?? '{}',
        updatedAt,
      })
      .run()
  } else {
    const patch: Partial<typeof locationPrintConfig.$inferInsert> = {
      updatedAt,
    }
    if (input.printStagesJson !== undefined) {
      patch.printStagesJson = input.printStagesJson
    }

    db.update(locationPrintConfig)
      .set(patch)
      .where(eq(locationPrintConfig.locationId, locationId))
      .run()
  }

  const row = getLocationPrintConfig(db, locationId)
  if (!row) {
    throw new Error(`Print config upsert failed for ${locationId}`)
  }
  return row
}
