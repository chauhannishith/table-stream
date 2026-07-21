import { and, desc, eq } from 'drizzle-orm'
import { printJobs } from '@table-stream/shared-types/hub'
import type { PrintJobStatus } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { newId } from '../lib/ids.js'

export type PrintJobRow = typeof printJobs.$inferSelect

export function getPrintJobById(
  db: HubDb,
  locationId: string,
  id: string,
): PrintJobRow | undefined {
  return db
    .select()
    .from(printJobs)
    .where(and(eq(printJobs.id, id), eq(printJobs.locationId, locationId)))
    .get()
}

export type CreatePrintJobInput = {
  orderId: string
  stage: string
  printerId?: string | null
  submitBatch?: number | null
  payloadJson: string
}

export function createPrintJob(
  db: HubDb,
  locationId: string,
  input: CreatePrintJobInput,
): PrintJobRow {
  const id = newId('pj')
  db.insert(printJobs)
    .values({
      id,
      locationId,
      orderId: input.orderId,
      stage: input.stage,
      printerId: input.printerId ?? null,
      submitBatch: input.submitBatch ?? null,
      payloadJson: input.payloadJson,
      status: 'PENDING',
      attemptCount: 0,
    })
    .run()

  const row = getPrintJobById(db, locationId, id)
  if (!row) {
    throw new Error(`Print job insert failed for ${id}`)
  }
  return row
}

export function listPrintJobsForOrder(
  db: HubDb,
  locationId: string,
  orderId: string,
): PrintJobRow[] {
  return db
    .select()
    .from(printJobs)
    .where(
      and(
        eq(printJobs.locationId, locationId),
        eq(printJobs.orderId, orderId),
      ),
    )
    .orderBy(desc(printJobs.createdAt))
    .all()
}

export function updatePrintJobStatus(
  db: HubDb,
  locationId: string,
  id: string,
  status: PrintJobStatus,
  options: { incrementAttempts?: boolean } = {},
): PrintJobRow | null {
  const existing = getPrintJobById(db, locationId, id)
  if (!existing) return null

  const patch: Partial<typeof printJobs.$inferInsert> = { status }
  if (options.incrementAttempts) {
    patch.attemptCount = existing.attemptCount + 1
  }

  db.update(printJobs)
    .set(patch)
    .where(and(eq(printJobs.id, id), eq(printJobs.locationId, locationId)))
    .run()

  return getPrintJobById(db, locationId, id) ?? null
}
