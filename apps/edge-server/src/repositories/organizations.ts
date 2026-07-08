import { eq } from 'drizzle-orm'
import { organizations } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'

export type OrganizationRow = typeof organizations.$inferSelect

export function getOrganizationById(
  db: HubDb,
  id: string,
): OrganizationRow | undefined {
  return db.select().from(organizations).where(eq(organizations.id, id)).get()
}

export function upsertOrganization(
  db: HubDb,
  input: { id: string; name: string },
): OrganizationRow {
  db.insert(organizations)
    .values({
      id: input.id,
      name: input.name,
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        name: input.name,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
    })
    .run()

  const row = getOrganizationById(db, input.id)
  if (!row) {
    throw new Error(`Organization upsert failed for ${input.id}`)
  }
  return row
}
