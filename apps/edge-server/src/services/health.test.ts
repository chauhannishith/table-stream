import { describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { checkSqlite, checkRedis, runReadinessChecks } from './health.js'
import type { HubDb } from '../db/client.js'
import type { RedisClient } from '../redis/client.js'

describe('checkSqlite', () => {
  it('returns ok when SELECT 1 succeeds', () => {
    const db = {
      run: vi.fn(),
    } as unknown as HubDb

    expect(checkSqlite(db)).toEqual({ ok: true })
    expect(db.run).toHaveBeenCalledWith(sql`SELECT 1`)
  })

  it('returns error when SELECT 1 fails', () => {
    const db = {
      run: () => {
        throw new Error('db down')
      },
    } as unknown as HubDb

    expect(checkSqlite(db)).toEqual({ ok: false, error: 'db down' })
  })
})

describe('checkRedis', () => {
  it('returns ok when ping returns PONG', async () => {
    const redis = { ping: async () => 'PONG' } as unknown as RedisClient
    await expect(checkRedis(redis)).resolves.toEqual({ ok: true })
  })

  it('returns error when ping fails', async () => {
    const redis = {
      ping: async () => {
        throw new Error('redis down')
      },
    } as unknown as RedisClient

    await expect(checkRedis(redis)).resolves.toEqual({
      ok: false,
      error: 'redis down',
    })
  })
})

describe('runReadinessChecks', () => {
  it('is error when sqlite is ok but redis is not', async () => {
    const db = { run: vi.fn() } as unknown as HubDb
    const redis = {
      ping: async () => {
        throw new Error('redis down')
      },
    } as unknown as RedisClient

    const result = await runReadinessChecks({ db, redis })
    expect(result.status).toBe('error')
    expect(result.checks.sqlite.ok).toBe(true)
    expect(result.checks.redis.ok).toBe(false)
  })

  it('is error when sqlite is not ok', async () => {
    const db = {
      run: () => {
        throw new Error('db down')
      },
    } as unknown as HubDb
    const redis = { ping: async () => 'PONG' } as unknown as RedisClient

    const result = await runReadinessChecks({ db, redis })
    expect(result.status).toBe('error')
    expect(result.checks.sqlite.ok).toBe(false)
  })

  it('is ok when sqlite and redis both succeed', async () => {
    const db = { run: vi.fn() } as unknown as HubDb
    const redis = { ping: async () => 'PONG' } as unknown as RedisClient

    const result = await runReadinessChecks({ db, redis })
    expect(result.status).toBe('ok')
    expect(result.checks.sqlite.ok).toBe(true)
    expect(result.checks.redis.ok).toBe(true)
  })
})
