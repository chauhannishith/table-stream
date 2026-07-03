import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { HubConfig } from './config.js'
import type { HubDb } from './db/client.js'
import type { RedisClient } from './redis/client.js'

const testConfig: HubConfig = {
  org_id: 'org_test',
  location_id: 'loc_test',
  hub_id: 'hub_test',
  location_name: 'Test Location',
  timezone: 'UTC',
  control_plane: { url: 'http://localhost:3000' },
  cloud_sync_enabled: false,
  lan: {
    bind: '127.0.0.1',
    port: 8443,
    mdns_name: 'test-hub',
  },
  data_dir: '/tmp/tablestream-test',
}

const testDb = {} as HubDb

const testRedis = {
  connect: async () => undefined,
} as unknown as RedisClient

describe('edge-server routes', () => {
  it('GET /health returns hub identity', async () => {
    const app = await buildApp({
      config: testConfig,
      db: testDb,
      redis: testRedis,
    })

    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.hub_id).toBe('hub_test')
    expect(body.org_id).toBe('org_test')

    await app.close()
  })

  it('GET /v1/status reflects subscription env', async () => {
    const app = await buildApp({
      config: testConfig,
      db: testDb,
      redis: testRedis,
    })

    const res = await app.inject({ method: 'GET', url: '/v1/status' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.hub_status).toBe('ACTIVE')
    expect(body.cloud_sync_enabled).toBe(false)

    await app.close()
  })
})
