import { sql } from 'drizzle-orm'
import type { HubDb } from '../db/client.js'

export function getLatestSchemaVersion(db: HubDb): string | null {
  try {
    const rows = db.all(
      sql`SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1`,
    ) as Array<{ id: string }>
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}
