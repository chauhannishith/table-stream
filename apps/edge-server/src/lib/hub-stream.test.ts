import { describe, expect, it } from 'vitest'
import { streamEventsKey } from './redis-keys.js'
import type { RedisClient } from '../redis/client.js'
import {
  parseHubStreamFields,
  publishHubStreamEvent,
  readHubStreamEvents,
} from './hub-stream.js'

type StreamEntry = {
  id: string
  fields: string[]
}

function createStreamRedis(): RedisClient & {
  entries(): StreamEntry[]
} {
  const streams = new Map<string, StreamEntry[]>()
  let seq = 0
  const waiters: Array<() => void> = []

  const notify = () => {
    while (waiters.length > 0) {
      waiters.shift()?.()
    }
  }

  const waitForEntry = (key: string, afterId: string, blockMs: number) =>
    new Promise<void>((resolve) => {
      const hasNew = () => {
        const rows = streams.get(key) ?? []
        return rows.some((row) => row.id > afterId)
      }

      if (hasNew()) {
        resolve()
        return
      }

      const timer = setTimeout(() => {
        const index = waiters.indexOf(onNotify)
        if (index >= 0) waiters.splice(index, 1)
        resolve()
      }, blockMs)

      const onNotify = () => {
        if (!hasNew()) return
        clearTimeout(timer)
        const index = waiters.indexOf(onNotify)
        if (index >= 0) waiters.splice(index, 1)
        resolve()
      }

      waiters.push(onNotify)
    })

  return {
    async xadd(
      key: string,
      id: string,
      ...fieldValues: string[]
    ): Promise<string> {
      const entryId = id === '*' ? `${Date.now()}-${++seq}` : id
      const rows = streams.get(key) ?? []
      rows.push({ id: entryId, fields: fieldValues })
      streams.set(key, rows)
      notify()
      return entryId
    },

    async xread(...args: Array<string | number>) {
      let blockMs = 0
      let streamsIndex = 0
      if (args[0] === 'BLOCK') {
        blockMs = Number(args[1])
        streamsIndex = 2
      }

      const key = String(args[streamsIndex + 1])
      const lastId = String(args[streamsIndex + 2])
      const rows = streams.get(key) ?? []

      if (lastId === '$') {
        const marker = rows.length > 0 ? rows[rows.length - 1]!.id : '0-0'
        if (blockMs > 0) {
          await waitForEntry(key, marker, blockMs)
        }
        const pending = (streams.get(key) ?? []).filter((row) => row.id > marker)
        if (pending.length === 0) return null
        return [[key, pending.map((row) => [row.id, ...row.fields])]]
      }

      const pending =
        lastId === '0'
          ? rows
          : rows.filter((row) => row.id > lastId)
      if (pending.length === 0) return null
      return [[key, pending.map((row) => [row.id, ...row.fields])]]
    },

    entries() {
      return [...(streams.get(streamEventsKey()) ?? [])]
    },
  } as unknown as RedisClient & {
    entries(): StreamEntry[]
  }
}

describe('hub stream', () => {
  it('parses canonical stream field arrays', () => {
    const event = parseHubStreamFields([
      'event_id',
      'evt_1',
      'event_type',
      'order.submitted',
      'location_id',
      'loc_1',
      'occurred_at',
      '2026-07-20T10:00:00.000Z',
      'payload',
      JSON.stringify({ order_id: 'ord_1' }),
    ])

    expect(event).toEqual({
      event_id: 'evt_1',
      event_type: 'order.submitted',
      location_id: 'loc_1',
      occurred_at: '2026-07-20T10:00:00.000Z',
      payload: { order_id: 'ord_1' },
    })
  })

  it('appends and reads events from the Redis stream', async () => {
    const redis = createStreamRedis()

    const entryId = await publishHubStreamEvent(redis, 'loc_1', 'line.updated', {
      line_id: 'line_1',
      status: 'IN_PROGRESS',
    })

    expect(entryId).toBeTruthy()
    expect(redis.entries()).toHaveLength(1)

    const events = await readHubStreamEvents(redis, '0')
    expect(events).toEqual([
      expect.objectContaining({
        id: entryId,
        event: expect.objectContaining({
          event_type: 'line.updated',
          location_id: 'loc_1',
          payload: { line_id: 'line_1', status: 'IN_PROGRESS' },
        }),
      }),
    ])
  })

  it('blocks until a new event arrives when reading from $', async () => {
    const redis = createStreamRedis()

    const pending = readHubStreamEvents(redis, '$', 2000)
    await publishHubStreamEvent(redis, 'loc_1', 'order.submitted', {
      order_id: 'ord_1',
    })

    const events = await pending
    expect(events).toHaveLength(1)
    expect(events[0]?.event.event_type).toBe('order.submitted')
  })
})
