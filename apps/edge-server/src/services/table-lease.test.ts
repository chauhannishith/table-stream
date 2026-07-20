import { describe, expect, it } from 'vitest'
import { AppError } from '../lib/errors.js'
import { leaseKey, leaseMetaKey } from '../lib/redis-keys.js'
import type { RedisClient } from '../redis/client.js'
import {
  acquireTableLease,
  releaseTableLease,
} from './table-lease.js'

type Entry = {
  value: string
  expiresAtMs: number | null
  hash?: Record<string, string>
}

/** Minimal Redis stub for SET NX EX / GET / DEL / HSET / HGETALL / EXPIRE. */
function createMemoryRedis(): RedisClient {
  const store = new Map<string, Entry>()

  function isAlive(entry: Entry | undefined): entry is Entry {
    if (!entry) return false
    if (entry.expiresAtMs != null && entry.expiresAtMs <= Date.now()) {
      return false
    }
    return true
  }

  function getAlive(key: string): Entry | undefined {
    const entry = store.get(key)
    if (!isAlive(entry)) {
      store.delete(key)
      return undefined
    }
    return entry
  }

  return {
    async set(
      key: string,
      value: string,
      ...args: Array<string | number>
    ): Promise<'OK' | null> {
      let ttlSeconds: number | undefined
      let nx = false
      for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === 'NX') nx = true
        if (arg === 'EX') {
          ttlSeconds = Number(args[i + 1])
          i++
        }
      }

      const existing = getAlive(key)
      if (nx && existing) return null

      store.set(key, {
        value,
        expiresAtMs:
          ttlSeconds != null ? Date.now() + ttlSeconds * 1000 : null,
      })
      return 'OK'
    },

    async get(key: string): Promise<string | null> {
      return getAlive(key)?.value ?? null
    },

    async del(...keys: string[]): Promise<number> {
      let removed = 0
      for (const key of keys) {
        if (store.delete(key)) removed++
      }
      return removed
    },

    async hset(key: string, data: Record<string, string>): Promise<number> {
      const existing = getAlive(key)
      const hash = { ...(existing?.hash ?? {}), ...data }
      store.set(key, {
        value: existing?.value ?? '',
        expiresAtMs: existing?.expiresAtMs ?? null,
        hash,
      })
      return Object.keys(data).length
    },

    async hgetall(key: string): Promise<Record<string, string>> {
      return { ...(getAlive(key)?.hash ?? {}) }
    },

    async expire(key: string, ttlSeconds: number): Promise<number> {
      const entry = getAlive(key)
      if (!entry) return 0
      entry.expiresAtMs = Date.now() + ttlSeconds * 1000
      store.set(key, entry)
      return 1
    },
  } as unknown as RedisClient
}

describe('table lease service', () => {
  it('acquires a lease with SET NX EX and stores holder meta', async () => {
    const redis = createMemoryRedis()

    const result = await acquireTableLease(redis, {
      locationId: 'loc_test',
      tableId: 'tbl_1',
      actorId: 'staff_a',
      ttlSeconds: 60,
    })

    expect(result.leaseToken).toBeTruthy()
    expect(result.ttlSeconds).toBe(60)
    expect(await redis.get(leaseKey('loc_test', 'table', 'tbl_1'))).toBe(
      result.leaseToken,
    )

    const meta = await redis.hgetall(
      leaseMetaKey('loc_test', result.leaseToken),
    )
    expect(meta.actor_id).toBe('staff_a')
    expect(meta.resource_id).toBe('tbl_1')
    expect(meta.resource_type).toBe('table')
  })

  it('rejects a second waiter with CONFLICT (dual lease)', async () => {
    const redis = createMemoryRedis()

    const first = await acquireTableLease(redis, {
      locationId: 'loc_test',
      tableId: 'tbl_1',
      actorId: 'staff_a',
    })

    try {
      await acquireTableLease(redis, {
        locationId: 'loc_test',
        tableId: 'tbl_1',
        actorId: 'staff_b',
      })
      expect.unreachable('second acquire should conflict')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const err = error as AppError
      expect(err.code).toBe('CONFLICT')
      expect(err.statusCode).toBe(409)
      expect(err.details.table_id).toBe('tbl_1')
      expect((err.details.holder as { actor_id?: string }).actor_id).toBe(
        'staff_a',
      )
    }

    expect(await redis.get(leaseKey('loc_test', 'table', 'tbl_1'))).toBe(
      first.leaseToken,
    )
  })

  it('releases when the matching lease token is presented', async () => {
    const redis = createMemoryRedis()

    const acquired = await acquireTableLease(redis, {
      locationId: 'loc_test',
      tableId: 'tbl_1',
      actorId: 'staff_a',
    })

    await releaseTableLease(redis, {
      locationId: 'loc_test',
      tableId: 'tbl_1',
      leaseToken: acquired.leaseToken,
    })

    expect(await redis.get(leaseKey('loc_test', 'table', 'tbl_1'))).toBeNull()
  })

  it('rejects release with a mismatched token', async () => {
    const redis = createMemoryRedis()

    await acquireTableLease(redis, {
      locationId: 'loc_test',
      tableId: 'tbl_1',
      actorId: 'staff_a',
    })

    await expect(
      releaseTableLease(redis, {
        locationId: 'loc_test',
        tableId: 'tbl_1',
        leaseToken: 'wrong-token',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })
})
