import { and, eq } from 'drizzle-orm'
import { tokenCounters } from '@table-stream/shared-types/hub'
import type { OrderType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'

const PREFIX: Record<OrderType, string> = {
  TAKEAWAY: 'T',
  DINE_IN: 'D',
}

export function nextTokenNumber(
  db: HubDb,
  locationId: string,
  orderType: OrderType,
  dayKey = new Date().toISOString().slice(0, 10),
): string {
  const counterKey = `${orderType}:${dayKey}`
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

  return `${PREFIX[orderType]}-${String(next).padStart(3, '0')}`
}
