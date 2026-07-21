import { and, asc, eq } from 'drizzle-orm'
import { printers } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'
import { nowSqliteTimestamp } from '../lib/timestamps.js'

export type PrinterRow = typeof printers.$inferSelect

export type ListPrintersOptions = {
  includeInactive?: boolean
}

export function listPrinters(
  db: HubDb,
  locationId: string,
  options: ListPrintersOptions = {},
): PrinterRow[] {
  const conditions = [eq(printers.locationId, locationId)]
  if (!options.includeInactive) {
    conditions.push(eq(printers.isActive, true))
  }

  return db
    .select()
    .from(printers)
    .where(and(...conditions))
    .orderBy(asc(printers.name))
    .all()
}

export function getPrinterById(
  db: HubDb,
  locationId: string,
  id: string,
): PrinterRow | undefined {
  return db
    .select()
    .from(printers)
    .where(and(eq(printers.id, id), eq(printers.locationId, locationId)))
    .get()
}

export type CreatePrinterInput = {
  name: string
  role: string
  connectionJson?: Record<string, unknown>
  kdsStationIds?: string[] | null
  isActive?: boolean
}

export function createPrinter(
  db: HubDb,
  locationId: string,
  input: CreatePrinterInput,
): PrinterRow {
  const id = newId('prn')
  db.insert(printers)
    .values({
      id,
      locationId,
      name: input.name,
      role: input.role,
      connectionJson: JSON.stringify(input.connectionJson ?? {}),
      kdsStationIdsJson:
        input.kdsStationIds === undefined
          ? null
          : JSON.stringify(input.kdsStationIds),
      isActive: input.isActive ?? true,
    })
    .run()

  const row = getPrinterById(db, locationId, id)
  if (!row) {
    throw new Error(`Printer insert failed for ${id}`)
  }
  return row
}

export type UpdatePrinterInput = {
  name?: string
  role?: string
  connectionJson?: Record<string, unknown>
  kdsStationIds?: string[] | null
  isActive?: boolean
}

export function updatePrinter(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdatePrinterInput,
): PrinterRow | null {
  const existing = getPrinterById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof printers.$inferInsert> = {
    updatedAt: nowSqliteTimestamp(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.role !== undefined) patch.role = input.role
  if (input.connectionJson !== undefined) {
    patch.connectionJson = JSON.stringify(input.connectionJson)
  }
  if (input.kdsStationIds !== undefined) {
    patch.kdsStationIdsJson =
      input.kdsStationIds === null
        ? null
        : JSON.stringify(input.kdsStationIds)
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive

  db.update(printers)
    .set(patch)
    .where(and(eq(printers.id, id), eq(printers.locationId, locationId)))
    .run()

  return getPrinterById(db, locationId, id) ?? null
}
