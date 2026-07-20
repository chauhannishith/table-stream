import { kdsItemKey, kdsQueueKey } from '../lib/redis-keys.js'
import type { RedisClient } from '../redis/client.js'

type CachedOrder = {
  id: string
  order_type: string
  table_id?: string | null
  token_number?: string | null
}

type CachedLine = {
  id: string
  menu_item_id: string
  name: string
  quantity: number
  modifiers: unknown[]
  tags: unknown[]
  special_instructions?: string | null
  kds_station_id?: string | null
  status: string
  submit_batch?: number | null
  submitted_at?: string | null
  kds_visible: boolean
}

function queueScore(submittedAt?: string | null): number {
  if (!submittedAt) return Date.now()
  const parsed = Date.parse(submittedAt)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export async function cacheSubmittedKdsLines(
  redis: RedisClient,
  input: {
    order: CachedOrder
    lines: CachedLine[]
  },
): Promise<void> {
  for (const line of input.lines) {
    if (!line.kds_station_id || !line.kds_visible) continue

    const queuedAt = line.submitted_at ?? new Date().toISOString()
    const stationId = line.kds_station_id

    await redis.zadd(kdsQueueKey(stationId), queueScore(queuedAt), line.id)
    await redis.hset(kdsItemKey(stationId, line.id), {
      order_id: input.order.id,
      table_id: input.order.table_id ?? '',
      order_type: input.order.order_type,
      token_number: input.order.token_number ?? '',
      menu_item_id: line.menu_item_id,
      name: line.name,
      quantity: String(line.quantity),
      modifiers_json: JSON.stringify(line.modifiers),
      tags_json: JSON.stringify(line.tags),
      special_instructions: line.special_instructions ?? '',
      status: line.status,
      submit_batch: String(line.submit_batch ?? 0),
      kds_visible: String(line.kds_visible),
      queued_at: queuedAt,
    })
  }
}
