import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { kdsItemKey, kdsQueueKey } from '../lib/redis-keys.js'
import type { RedisClient } from '../redis/client.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import {
  createKdsStationEntry,
  createZoneEntry,
} from '../services/floor-setup.js'

type QueueEntry = {
  member: string
  score: number
}

function createKdsRedis(): RedisClient & {
  zrangeWithScores(key: string): QueueEntry[]
  hgetallLocal(key: string): Record<string, string>
} {
  const hashes = new Map<string, Record<string, string>>()
  const queues = new Map<string, QueueEntry[]>()

  return {
    async connect() {
      return undefined
    },
    async ping() {
      return 'PONG'
    },
    async zadd(key: string, score: number, member: string): Promise<number> {
      const next = [...(queues.get(key) ?? []).filter((row) => row.member !== member)]
      next.push({ member, score })
      next.sort((a, b) => a.score - b.score || a.member.localeCompare(b.member))
      queues.set(key, next)
      return 1
    },
    async hset(key: string, data: Record<string, string>): Promise<number> {
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...data })
      return Object.keys(data).length
    },
    zrangeWithScores(key: string): QueueEntry[] {
      return [...(queues.get(key) ?? [])]
    },
    hgetallLocal(key: string): Record<string, string> {
      return { ...(hashes.get(key) ?? {}) }
    },
  } as unknown as RedisClient & {
    zrangeWithScores(key: string): QueueEntry[]
    hgetallLocal(key: string): Record<string, string>
  }
}

async function seedTakeawayOrderWithLine() {
  const app = await createTestApp()
  const locationId = app.hubConfig.location_id
  const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
  const station = createKdsStationEntry(app.hubDb, locationId, {
    name: 'Grill',
  })
  const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
  const item = createMenuItemEntry(app.hubDb, locationId, {
    categoryId: category.id,
    name: 'Burger',
    basePriceCents: 500,
    kdsStationId: station.id,
  })

  const orderRes = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    payload: {
      order_type: 'TAKEAWAY',
      zone_id: zone.id,
      customer_name: 'Alex',
    },
  })
  const orderId = orderRes.json().order.id

  await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/lines`,
    payload: { menu_item_id: item.id },
  })

  return { app, orderId, stationId: station.id, itemId: item.id }
}

describe('order submit & KDS', () => {
  it('submits draft lines, issues takeaway token, and is idempotent', async () => {
    const { app, orderId } = await seedTakeawayOrderWithLine()

    const first = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
      headers: { 'idempotency-key': 'submit-1' },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json().submission.order.token_number).toMatch(/^T-\d{3}$/)
    expect(first.json().submission.submit_batch).toBe(1)
    expect(first.json().submission.lines[0].is_submitted).toBe(true)
    expect(first.json().submission.lines[0].status).toBe('QUEUED')
    expect(first.json().submission.lines[0].kds_visible).toBe(true)

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
      headers: { 'idempotency-key': 'submit-1' },
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toEqual(first.json())

    const empty = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
    })
    expect(empty.statusCode).toBe(400)

    await app.close()
  })

  it('lists KDS queue and advances line status', async () => {
    const { app, orderId, stationId } = await seedTakeawayOrderWithLine()

    await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
    })

    const queue = await app.inject({
      method: 'GET',
      url: `/v1/kds/queue?station_id=${stationId}`,
    })
    expect(queue.statusCode).toBe(200)
    expect(queue.json().items).toHaveLength(1)
    const lineId = queue.json().items[0].id

    const progress = await app.inject({
      method: 'PATCH',
      url: `/v1/kds/lines/${lineId}/status`,
      payload: { status: 'IN_PROGRESS' },
    })
    expect(progress.statusCode).toBe(200)
    expect(progress.json().line.status).toBe('IN_PROGRESS')

    const prepared = await app.inject({
      method: 'PATCH',
      url: `/v1/kds/lines/${lineId}/status`,
      payload: { status: 'PREPARED' },
    })
    expect(prepared.statusCode).toBe(200)
    expect(prepared.json().line.status).toBe('PREPARED')
    expect(prepared.json().line.kds_visible).toBe(false)

    const after = await app.inject({
      method: 'GET',
      url: `/v1/kds/queue?station_id=${stationId}`,
    })
    expect(after.json().items).toHaveLength(0)

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/v1/kds/lines/${lineId}/status`,
      payload: { status: 'QUEUED' },
    })
    expect(invalid.statusCode).toBe(400)

    await app.close()
  })

  it('increments submit_batch for add-on rounds', async () => {
    const { app, orderId, itemId } = await seedTakeawayOrderWithLine()

    await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
    })

    await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: { menu_item_id: itemId },
    })

    const second = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
    })
    expect(second.statusCode).toBe(200)
    expect(second.json().submission.submit_batch).toBe(2)
    expect(second.json().submission.order.status).toBe('IN_KITCHEN')

    await app.close()
  })

  it('mirrors submitted KDS lines into Redis station keys', async () => {
    const redis = createKdsRedis()
    const app = await createTestApp({ redis })
    const locationId = app.hubConfig.location_id
    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
    const station = createKdsStationEntry(app.hubDb, locationId, {
      name: 'Grill',
    })
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Burger',
      basePriceCents: 500,
      kdsStationId: station.id,
    })

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Alex',
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
    const lineId = submit.json().submission.lines[0].id
    expect(redis.zrangeWithScores(kdsQueueKey(station.id))).toEqual([
      expect.objectContaining({ member: lineId }),
    ])
    expect(redis.hgetallLocal(kdsItemKey(station.id, lineId))).toEqual(
      expect.objectContaining({
        order_id: orderId,
        order_type: 'TAKEAWAY',
        name: 'Burger',
        status: 'QUEUED',
      }),
    )

    await app.close()
  })
})
