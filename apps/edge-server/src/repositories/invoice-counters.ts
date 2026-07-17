import { and, eq } from 'drizzle-orm'
import { tokenCounters } from '@table-stream/shared-types/hub'
import type { HubDb } from '../db/client.js'

export function nextInvoiceNumber(db: HubDb, locationId: string): string {
  const counterKey = 'invoice'
  const existing = db
    .select()
    .from(tokenCounters)
    .where(
      and(
        eq(tokenCounters.locationId, locationId),
        eq(tokenCounters.counterKey, counterKey),
      ),
    )
    .get()

  const next = (existing?.value ?? 0) + 1

  if (existing) {
    db.update(tokenCounters)
      .set({ value: next })
      .where(
        and(
          eq(tokenCounters.locationId, locationId),
          eq(tokenCounters.counterKey, counterKey),
        ),
      )
      .run()
  } else {
    db.insert(tokenCounters)
      .values({ locationId, counterKey, value: next })
      .run()
  }

  return `INV-${String(next).padStart(5, '0')}`
}
