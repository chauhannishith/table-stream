import { randomUUID } from 'node:crypto'
import { AppError } from '../lib/errors.js'
import { leaseKey, leaseMetaKey } from '../lib/redis-keys.js'
import type { RedisClient } from '../redis/client.js'

export const DEFAULT_LEASE_TTL_SECONDS = 300

export type AcquireTableLeaseInput = {
  locationId: string
  tableId: string
  actorId: string
  ttlSeconds?: number
}

export type AcquireTableLeaseResult = {
  leaseToken: string
  ttlSeconds: number
}

/**
 * Atomically acquire a table lease via SET NX EX.
 * @throws {AppError} CONFLICT when another waiter already holds the lease
 */
export async function acquireTableLease(
  redis: RedisClient,
  input: AcquireTableLeaseInput,
): Promise<AcquireTableLeaseResult> {
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_LEASE_TTL_SECONDS
  const leaseToken = randomUUID()
  const key = leaseKey(input.locationId, 'table', input.tableId)

  const result = await redis.set(key, leaseToken, 'EX', ttlSeconds, 'NX')
  if (result !== 'OK') {
    const holderToken = await redis.get(key)
    const holder =
      holderToken != null
        ? await redis.hgetall(leaseMetaKey(input.locationId, holderToken))
        : {}
    throw new AppError('CONFLICT', 'Table lease already held', 409, {
      table_id: input.tableId,
      holder,
    })
  }

  const metaKey = leaseMetaKey(input.locationId, leaseToken)
  await redis.hset(metaKey, {
    resource_type: 'table',
    resource_id: input.tableId,
    actor_id: input.actorId,
    created_at: new Date().toISOString(),
  })
  await redis.expire(metaKey, ttlSeconds)

  return { leaseToken, ttlSeconds }
}

/**
 * Release a table lease when the caller presents the matching token.
 * @throws {AppError} NOT_FOUND when no lease; FORBIDDEN on token mismatch
 */
export async function releaseTableLease(
  redis: RedisClient,
  input: {
    locationId: string
    tableId: string
    leaseToken: string
  },
): Promise<void> {
  const key = leaseKey(input.locationId, 'table', input.tableId)
  const current = await redis.get(key)

  if (current == null) {
    throw new AppError('NOT_FOUND', 'Table lease not found', 404, {
      table_id: input.tableId,
    })
  }
  if (current !== input.leaseToken) {
    throw new AppError('FORBIDDEN', 'Lease token mismatch', 403, {
      table_id: input.tableId,
    })
  }

  await redis.del(key, leaseMetaKey(input.locationId, input.leaseToken))
}
