import Database from 'better-sqlite3'
import type { HubConfig } from '../config.js'
import { buildApp, type AppDeps } from '../app.js'
import { createHubDbFromSqlite, type HubDb } from '../db/client.js'
import { applyMigrationsToSqlite } from '../db/migrate.js'
import { hashDeviceToken, hashPin, issueDeviceToken } from '../lib/auth.js'
import { createStaffSession } from '../lib/staff-sessions.js'
import type { RedisClient } from '../redis/client.js'
import { createDevice } from '../repositories/devices.js'
import { createStaff } from '../repositories/staff.js'
import { seedHubFromConfig } from '../services/hub-seed.js'

export const testHubConfig: HubConfig = {
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

export function createTestHubDb(): HubDb {
  const sqlite = new Database(':memory:')
  applyMigrationsToSqlite(sqlite)
  return createHubDbFromSqlite(sqlite)
}

export function createTestRedis(): RedisClient {
  return {
    connect: async () => undefined,
    ping: async () => 'PONG',
    zadd: async () => 1,
    hset: async () => 1,
    xadd: async () => '0-1',
    xread: async () => null,
  } as unknown as RedisClient
}

export type TestApp = Awaited<ReturnType<typeof buildApp>> & {
  testDeviceToken?: string
  testStaffToken?: string
}

export async function createTestApp(
  overrides: Partial<AppDeps> = {},
): Promise<TestApp> {
  const config = overrides.config ?? testHubConfig
  const db = overrides.db ?? createTestHubDb()
  if (!overrides.db) {
    seedHubFromConfig(db, config)
  }

  const app = (await buildApp({
    config,
    db,
    redis: overrides.redis ?? createTestRedis(),
  })) as TestApp

  if (!overrides.db) {
    const token = issueDeviceToken()
    createDevice(db, config.location_id, {
      deviceType: 'COUNTER',
      name: 'Test Device',
      deviceTokenHash: hashDeviceToken(token),
    })
    app.testDeviceToken = token

    const admin = createStaff(db, config.location_id, {
      name: 'Test Admin',
      role: 'ADMIN',
      pinHash: hashPin('0000'),
    })
    const { token: staffToken } = createStaffSession({
      locationId: config.location_id,
      staffId: admin.id,
      role: admin.role,
    })
    app.testStaffToken = staffToken

    const originalInject = app.inject.bind(app) as (
      opts: string | Record<string, unknown>,
    ) => ReturnType<TestApp['inject']>
    app.inject = ((opts: unknown) => {
      if (typeof opts === 'string') {
        return originalInject({
          url: opts,
          headers: {
            'x-device-token': token,
            'x-staff-token': staffToken,
          },
        })
      }

      const request = (opts ?? {}) as Record<string, unknown>
      const incoming =
        request.headers && typeof request.headers === 'object'
          ? { ...(request.headers as Record<string, string>) }
          : {}
      const headers: Record<string, string> = { ...incoming }
      if (!('x-device-token' in headers)) headers['x-device-token'] = token
      if (!('x-staff-token' in headers)) headers['x-staff-token'] = staffToken
      if (headers['x-device-token'] === '') delete headers['x-device-token']
      if (headers['x-staff-token'] === '') delete headers['x-staff-token']

      return originalInject({
        ...request,
        headers,
      })
    }) as typeof app.inject
  }

  return app
}

export function seedMinimalLocation(
  db: HubDb,
  config: HubConfig = testHubConfig,
) {
  seedHubFromConfig(db, config)
}
