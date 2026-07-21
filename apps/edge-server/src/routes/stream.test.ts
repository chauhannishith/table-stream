import { describe, expect, it } from 'vitest'
import { streamEventsKey } from '../lib/redis-keys.js'
import type { RedisClient } from '../redis/client.js'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import { createZoneEntry } from '../services/floor-setup.js'

type StreamEntry = {
  id: string
  fields: string[]
}

export function createStreamRedis(): RedisClient & {
  streamEntries(): StreamEntry[]
} {
  const streams = new Map<string, StreamEntry[]>()
  let seq = 0

  return {
    connect: async () => undefined,
    ping: async () => 'PONG',
    zadd: async () => 1,
    hset: async () => 1,
    async xadd(
      key: string,
      id: string,
      ...fieldValues: string[]
    ): Promise<string> {
      const entryId = id === '*' ? `${Date.now()}-${++seq}` : id
      const rows = streams.get(key) ?? []
      rows.push({ id: entryId, fields: fieldValues })
      streams.set(key, rows)
      return entryId
    },
    async xread(...args: Array<string | number>) {
      let streamsIndex = 0
      if (args[0] === 'BLOCK') {
        streamsIndex = 2
      }

      const key = String(args[streamsIndex + 1])
      const lastId = String(args[streamsIndex + 2])
      const rows = streams.get(key) ?? []
      const pending =
        lastId === '$'
          ? []
          : lastId === '0'
            ? rows
            : rows.filter((row) => row.id > lastId)

      if (pending.length === 0) return null
      return [[key, pending.map((row) => [row.id, ...row.fields])]]
    },
    streamEntries() {
      return [...(streams.get(streamEventsKey()) ?? [])]
    },
  } as unknown as RedisClient & {
    streamEntries(): StreamEntry[]
  }
}

describe('stream events', () => {
  it('appends order.submitted to the Redis stream after submit', async () => {
    const redis = createStreamRedis()
    const app = await createTestApp({ redis })
    const locationId = app.hubConfig.location_id
    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Soup',
      basePriceCents: 300,
    })

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Lee',
      },
    })
    const orderId = orderRes.json().order.id
    await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: { menu_item_id: item.id },
    })

    const submit = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
    })
    expect(submit.statusCode).toBe(200)

    const entries = redis.streamEntries()
    expect(entries).toHaveLength(1)

    const fields = Object.fromEntries(
      entries[0]!.fields.reduce<[string, string][]>((acc, value, index, arr) => {
        if (index % 2 === 0) acc.push([value, arr[index + 1]!])
        return acc
      }, []),
    )

    expect(fields.event_type).toBe('order.submitted')
    expect(fields.location_id).toBe(locationId)
    expect(JSON.parse(fields.payload)).toEqual(
      expect.objectContaining({ order_id: orderId }),
    )

    await app.close()
  })
})
