import { and, eq } from 'drizzle-orm'
import { devices } from '@table-stream/shared-types/hub'
import type { DeviceType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type DeviceRow = typeof devices.$inferSelect

export type CreateDeviceInput = {
  deviceType: DeviceType
  name: string
  deviceTokenHash: string
  assignedZoneIdsJson?: string | null
  assignedStationIdsJson?: string | null
}

export function createDevice(
  db: HubDb,
  locationId: string,
  input: CreateDeviceInput,
): DeviceRow {
  const id = newId('dev')
  const now = nowSqliteTimestamp()

  db.insert(devices)
    .values({
      id,
      locationId,
      deviceType: input.deviceType,
      name: input.name,
      deviceTokenHash: input.deviceTokenHash,
      assignedZoneIdsJson: input.assignedZoneIdsJson ?? null,
      assignedStationIdsJson: input.assignedStationIdsJson ?? null,
      isActive: true,
      pairedAt: now,
      updatedAt: now,
    })
    .run()

  const row = getDeviceById(db, locationId, id)
  if (!row) {
    throw new Error(`Device insert failed for ${id}`)
  }
  return row
}

export function getDeviceById(
  db: HubDb,
  locationId: string,
  id: string,
): DeviceRow | undefined {
  return db
    .select()
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.locationId, locationId)))
    .get()
}

export function listActiveDevices(db: HubDb, locationId: string): DeviceRow[] {
  return db
    .select()
    .from(devices)
    .where(
      and(eq(devices.locationId, locationId), eq(devices.isActive, true)),
    )
    .all()
}

export function findActiveDeviceByTokenHash(
  db: HubDb,
  locationId: string,
  deviceTokenHash: string,
): DeviceRow | undefined {
  return db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.locationId, locationId),
        eq(devices.deviceTokenHash, deviceTokenHash),
        eq(devices.isActive, true),
      ),
    )
    .get()
}

export function touchDeviceLastSeen(
  db: HubDb,
  locationId: string,
  id: string,
): void {
  db.update(devices)
    .set({
      lastSeenAt: nowSqliteTimestamp(),
      updatedAt: nowSqliteTimestamp(),
    })
    .where(and(eq(devices.id, id), eq(devices.locationId, locationId)))
    .run()
}
