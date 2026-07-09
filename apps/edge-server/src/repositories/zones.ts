import { zones } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'

export function createZone(
  db: HubDb,
  locationId: string,
  input: { name: string; sortOrder?: number },
) {
  const id = newId('zone')
  db.insert(zones)
    .values({
      id,
      locationId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .run()

  return id
}
