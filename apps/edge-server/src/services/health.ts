import { sql } from 'drizzle-orm'
import type { HubDb } from '../db/client.js'
import type { RedisClient } from '../redis/client.js'

export type HealthCheckResult = {
  ok: boolean
  error?: string
}

export type ReadinessResult = {
  status: 'ok' | 'error'
  checks: {
    sqlite: HealthCheckResult
    redis: HealthCheckResult
  }
}

/** Probe SQLite with SELECT 1. */
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

/** Probe Redis with PING; ok only when the reply is PONG. */
export async function checkRedis(redis: RedisClient): Promise<HealthCheckResult> {
  try {
    const result = await redis.ping()
    if (result === 'PONG') return { ok: true }
    return { ok: false, error: `Unexpected ping reply: ${String(result)}` }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Redis unreachable',
    }
  }
}

/** Ready only when both SQLite and Redis succeed. */
export async function runReadinessChecks(deps: {
  db: HubDb
  redis: RedisClient
}): Promise<ReadinessResult> {
  const sqlite = checkSqlite(deps.db)
  const redis = await checkRedis(deps.redis)
  const ok = sqlite.ok && redis.ok

  return {
    status: ok ? 'ok' : 'error',
    checks: { sqlite, redis },
  }
}
