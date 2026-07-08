import { sql } from 'drizzle-orm'
import type { HubDb } from '../db/client.js'
import type { RedisClient } from '../redis/client.js'

export type HealthCheckResult = {
  ok: boolean
  error?: string
}

export type ReadinessResult = {
  status: 'ok' | 'degraded' | 'error'
  checks: {
    sqlite: HealthCheckResult
    redis: HealthCheckResult & { optional: boolean }
  }
}

export function checkSqlite(db: HubDb): HealthCheckResult {
  try {
    db.run(sql`SELECT 1`)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Database unreachable',
    }
  }
}

export async function checkRedis(redis: RedisClient): Promise<HealthCheckResult> {
  try {
    const result = await redis.ping()
    return { ok: result === 'PONG' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Redis unreachable',
    }
  }
}

export async function runReadinessChecks(deps: {
  db: HubDb
  redis: RedisClient
}): Promise<ReadinessResult> {
  const sqlite = checkSqlite(deps.db)
  const redis = await checkRedis(deps.redis)

  if (!sqlite.ok) {
    return {
      status: 'error',
      checks: {
        sqlite,
        redis: { ...redis, optional: true },
      },
    }
  }

  return {
    status: redis.ok ? 'ok' : 'degraded',
    checks: {
      sqlite,
      redis: { ...redis, optional: true },
    },
  }
}
