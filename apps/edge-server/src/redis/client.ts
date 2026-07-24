import { Redis } from 'ioredis'

/** XREAD reply shape used by hub stream helpers. */
export type RedisStreamReadResult = Array<
  [key: string, items: Array<[id: string, fields: string[]]>]
> | null

/**
 * Redis methods the hub actually calls.
 * Prefer this over the full ioredis `Redis` class so tests can stub without casts.
 */
export type RedisClient = {
  connect(): Promise<void>
  ping(): Promise<string>
  zadd(key: string, score: number, member: string): Promise<number>
  hset(key: string, data: Record<string, string>): Promise<number>
  hgetall(key: string): Promise<Record<string, string>>
  xadd(
    key: string,
    id: string,
    ...fieldValues: string[]
  ): Promise<string | null>
  xread(...args: Array<string | number>): Promise<RedisStreamReadResult>
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
    condition: 'NX',
  ): Promise<string | null>
  get(key: string): Promise<string | null>
  del(...keys: string[]): Promise<number>
  expire(key: string, seconds: number): Promise<number>
}

/** Create a hub Redis client (lazy connect; call `connect()` at boot). */
export function createRedisClient(url: string): RedisClient {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })
}
