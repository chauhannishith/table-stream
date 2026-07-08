import { eq } from 'drizzle-orm'
import { locations } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'

export type LocationRow = typeof locations.$inferSelect

export type UpsertLocationInput = {
  id: string
  orgId: string
  name: string
  timezone: string
  hubId: string
  cloudSyncEnabled: boolean
}

export function getLocationById(
  db: HubDb,
  id: string,
): LocationRow | undefined {
  return db.select().from(locations).where(eq(locations.id, id)).get()
}

export function upsertLocation(
  db: HubDb,
  input: UpsertLocationInput,
): LocationRow {
  db.insert(locations)
    .values({
      id: input.id,
      orgId: input.orgId,
      name: input.name,
      timezone: input.timezone,
      hubId: input.hubId,
      cloudSyncEnabled: input.cloudSyncEnabled,
    })
    .onConflictDoUpdate({
      target: locations.id,
      set: {
        orgId: input.orgId,
        name: input.name,
        timezone: input.timezone,
        hubId: input.hubId,
        cloudSyncEnabled: input.cloudSyncEnabled,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
    })
    .run()

  const row = getLocationById(db, input.id)
  if (!row) {
    throw new Error(`Location upsert failed for ${input.id}`)
  }
  return row
}
