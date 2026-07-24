import { randomUUID } from 'node:crypto'
import type { RedisClient } from '../redis/client.js'
import { streamEventsKey } from './redis-keys.js'

export type HubStreamEvent = {
  event_id: string
  event_type: string
  location_id: string
  occurred_at: string
  payload: Record<string, unknown>
}

function eventToStreamFields(event: HubStreamEvent): string[] {
  return [
    'event_id',
    event.event_id,
    'event_type',
    event.event_type,
    'location_id',
    event.location_id,
    'occurred_at',
    event.occurred_at,
    'payload',
    JSON.stringify(event.payload),
  ]
}

/** Decode a Redis stream field array into a hub event envelope. */
export function parseHubStreamFields(fields: string[]): HubStreamEvent | null {
  const map: Record<string, string> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i]
    const value = fields[i + 1]
    if (key === undefined || value === undefined) continue
    map[key] = value
  }

  if (!map.event_type || !map.location_id) return null

  let payload: Record<string, unknown> = {}
  if (map.payload) {
    try {
      payload = JSON.parse(map.payload) as Record<string, unknown>
    } catch {
      payload = {}
    }
  }

  return {
    event_id: map.event_id ?? '',
    event_type: map.event_type,
    location_id: map.location_id,
    occurred_at: map.occurred_at ?? new Date().toISOString(),
    payload,
  }
}

/** Append a domain event to the hub Redis stream (`ts:stream:events`). */
export async function publishHubStreamEvent(
  redis: RedisClient,
  locationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const event: HubStreamEvent = {
    event_id: randomUUID(),
    event_type: eventType,
    location_id: locationId,
    occurred_at: new Date().toISOString(),
    payload,
  }

  const streamId = await redis.xadd(
    streamEventsKey(),
    '*',
    ...eventToStreamFields(event),
  )
  if (!streamId) {
    throw new Error('Failed to append hub stream event')
  }
  return streamId
}

/** Read hub stream entries after `lastId`, optionally blocking for new events. */
export async function readHubStreamEvents(
  redis: RedisClient,
  lastId: string,
  blockMs = 0,
): Promise<Array<{ id: string; event: HubStreamEvent }>> {
  const result =
    blockMs > 0
      ? await redis.xread(
          'BLOCK',
          blockMs,
          'STREAMS',
          streamEventsKey(),
          lastId,
        )
      : await redis.xread('STREAMS', streamEventsKey(), lastId)

  if (!result) return []

  const items: Array<{ id: string; event: HubStreamEvent }> = []
  for (const [, entries] of result) {
    for (const [entryId, fields] of entries) {
      const event = parseHubStreamFields(fields)
      if (event) {
        items.push({ id: entryId, event })
      }
    }
  }

  return items
}
