import { describe, expect, it } from 'vitest'
import { createTestApp, createTestHubDb, createTestRedis } from './test/fixtures.js'
import type { HubDb } from './db/client.js'

describe('edge-server routes', () => {
  it('GET /health returns liveness payload', async () => {
    const app = await createTestApp()

    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('edge-server')
    expect(body.hub_id).toBe('hub_test')
    expect(body.org_id).toBe('org_test')
    expect(typeof body.uptime_seconds).toBe('number')

    await app.close()
  })

  it('GET /health/ready returns 200 when sqlite is reachable', async () => {
    const app = await createTestApp()

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.sqlite.ok).toBe(true)
    expect(body.checks.redis.optional).toBe(true)

    await app.close()
  })

  it('GET /health/ready returns 503 when sqlite is down', async () => {
    const failingDb = {
      run: () => {
        throw new Error('db down')
      },
    } as unknown as HubDb

    const app = await createTestApp({ db: failingDb })

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)

    const body = res.json()
    expect(body.status).toBe('error')
    expect(body.checks.sqlite.ok).toBe(false)

    await app.close()
  })

  it('GET /v1/status reflects seeded identity and schema version', async () => {
    const app = await createTestApp()

    const res = await app.inject({ method: 'GET', url: '/v1/status' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.hub_status).toBe('ACTIVE')
    expect(body.cloud_sync_enabled).toBe(false)
    expect(body.location_name).toBe('Test Location')
    expect(body.db_ready).toBe(true)
    expect(body.schema_version).toBe('0002_menu_catalog.sql')

    await app.close()
  })

  it('unknown routes return 404 problem json', async () => {
    const app = await createTestApp()

    const res = await app.inject({ method: 'GET', url: '/does-not-exist' })
    expect(res.statusCode).toBe(404)

    const body = res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Route not found')

    await app.close()
  })
})

describe('test fixtures', () => {
  it('createTestHubDb applies migrations', () => {
    const db = createTestHubDb()
    expect(db).toBeDefined()
  })

  it('createTestRedis responds to ping', async () => {
    const redis = createTestRedis()
    await expect(redis.ping()).resolves.toBe('PONG')
  })
})
