import { and, eq } from 'drizzle-orm'
import { idempotencyKeys } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type IdempotencyRecord = {
  responseStatus: number
  responseBody: unknown
}

export function getIdempotencyResponse(
  db: HubDb,
  locationId: string,
  key: string,
  method: string,
  path: string,
): IdempotencyRecord | undefined {
  const row = db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.locationId, locationId),
        eq(idempotencyKeys.key, key),
        eq(idempotencyKeys.method, method),
        eq(idempotencyKeys.path, path),
      ),
    )
    .get()

  if (!row) return undefined

  return {
    responseStatus: row.responseStatus,
    responseBody: JSON.parse(row.responseBody) as unknown,
  }
}

export function saveIdempotencyResponse(
  db: HubDb,
  locationId: string,
  key: string,
  method: string,
  path: string,
  responseStatus: number,
  responseBody: unknown,
) {
  db.insert(idempotencyKeys)
    .values({
      id: newId('idem'),
      locationId,
      key,
      method,
      path,
      responseStatus,
      responseBody: JSON.stringify(responseBody),
      createdAt: nowSqliteTimestamp(),
    })
    .run()
}
