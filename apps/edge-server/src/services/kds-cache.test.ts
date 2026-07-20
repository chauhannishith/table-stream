import { describe, expect, it } from 'vitest'
import { kdsItemKey, kdsQueueKey } from '../lib/redis-keys.js'
import type { RedisClient } from '../redis/client.js'
import { cacheSubmittedKdsLines } from './kds-cache.js'

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

describe('kds cache', () => {
  it('mirrors submitted KDS lines into station queue and item hash', async () => {
    const redis = createKdsRedis()

    await cacheSubmittedKdsLines(redis, {
      order: {
        id: 'ord_1',
        order_type: 'TAKEAWAY',
        table_id: null,
        token_number: 'T-001',
      },
      lines: [
        {
          id: 'line_1',
          menu_item_id: 'item_1',
          name: 'Burger',
          quantity: 2,
          modifiers: [{ option_id: 'opt_1' }],
          tags: [{ id: 'tag_1' }],
          special_instructions: 'No onions',
          kds_station_id: 'station_1',
          status: 'QUEUED',
          submit_batch: 1,
          submitted_at: '2026-07-20T10:00:00.000Z',
          kds_visible: true,
        },
      ],
    })

    expect(redis.zrangeWithScores(kdsQueueKey('station_1'))).toEqual([
      {
        member: 'line_1',
        score: Date.parse('2026-07-20T10:00:00.000Z'),
      },
    ])

    expect(redis.hgetallLocal(kdsItemKey('station_1', 'line_1'))).toEqual(
      expect.objectContaining({
        order_id: 'ord_1',
        order_type: 'TAKEAWAY',
        token_number: 'T-001',
        quantity: '2',
        submit_batch: '1',
        status: 'QUEUED',
        kds_visible: 'true',
      }),
    )
  })

  it('skips lines with no station or hidden KDS visibility', async () => {
    const redis = createKdsRedis()

    await cacheSubmittedKdsLines(redis, {
      order: {
        id: 'ord_1',
        order_type: 'DINE_IN',
        table_id: 'tbl_1',
        token_number: null,
      },
      lines: [
        {
          id: 'line_hidden',
          menu_item_id: 'item_1',
          name: 'Soup',
          quantity: 1,
          modifiers: [],
          tags: [],
          special_instructions: null,
          kds_station_id: 'station_1',
          status: 'PREPARED',
          submit_batch: 1,
          submitted_at: '2026-07-20T10:00:00.000Z',
          kds_visible: false,
        },
        {
          id: 'line_no_station',
          menu_item_id: 'item_2',
          name: 'Tea',
          quantity: 1,
          modifiers: [],
          tags: [],
          special_instructions: null,
          kds_station_id: null,
          status: 'QUEUED',
          submit_batch: 1,
          submitted_at: '2026-07-20T10:00:01.000Z',
          kds_visible: true,
        },
      ],
    })

    expect(redis.zrangeWithScores(kdsQueueKey('station_1'))).toEqual([])
    expect(redis.hgetallLocal(kdsItemKey('station_1', 'line_hidden'))).toEqual({})
  })
})
