import { and, asc, eq } from 'drizzle-orm'
import { staff } from '@table-stream/shared-types/hub'
import type { StaffRole } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type StaffRow = typeof staff.$inferSelect

export type ListStaffOptions = {
  includeInactive?: boolean
}

export function listStaff(
  db: HubDb,
  locationId: string,
  options: ListStaffOptions = {},
): StaffRow[] {
  const conditions = [eq(staff.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(staff.isActive, true))
  }

  return db
    .select()
    .from(staff)
    .where(and(...conditions))
    .orderBy(asc(staff.name))
    .all()
}

export function getStaffById(
  db: HubDb,
  locationId: string,
  id: string,
): StaffRow | undefined {
  return db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.locationId, locationId)))
    .get()
}

export type CreateStaffInput = {
  name: string
  role: StaffRole
  pinHash: string
  assignedZoneIds?: string[]
  isActive?: boolean
}

export function createStaff(
  db: HubDb,
  locationId: string,
  input: CreateStaffInput,
): StaffRow {
  const id = newId('staff')
  db.insert(staff)
    .values({
      id,
      locationId,
      name: input.name,
      role: input.role,
      pinHash: input.pinHash,
      assignedZoneIdsJson: JSON.stringify(input.assignedZoneIds ?? []),
      isActive: input.isActive ?? true,
    })
    .run()

  const row = getStaffById(db, locationId, id)
  if (!row) {
    throw new Error(`Staff insert failed for ${id}`)
  }
  return row
}

export type UpdateStaffInput = {
  name?: string
  role?: StaffRole
  pinHash?: string
  assignedZoneIds?: string[]
  isActive?: boolean
}

export function updateStaff(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateStaffInput,
): StaffRow | null {
  const existing = getStaffById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof staff.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.role !== undefined) patch.role = input.role
  if (input.pinHash !== undefined) patch.pinHash = input.pinHash
  if (input.assignedZoneIds !== undefined) {
    patch.assignedZoneIdsJson = JSON.stringify(input.assignedZoneIds)
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(staff)
    .set(patch)
    .where(and(eq(staff.id, id), eq(staff.locationId, locationId)))
    .run()

  return getStaffById(db, locationId, id) ?? null
}
