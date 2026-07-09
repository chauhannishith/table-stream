import Database from 'better-sqlite3'
import type { HubConfig } from '../config.js'
import { buildApp, type AppDeps } from '../app.js'
import { createHubDbFromSqlite, type HubDb } from '../db/client.js'
import { applyMigrationsToSqlite } from '../db/migrate.js'
import type { RedisClient } from '../redis/client.js'
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
  } as unknown as RedisClient
}

export async function createTestApp(overrides: Partial<AppDeps> = {}) {
  const config = overrides.config ?? testHubConfig
  const db = overrides.db ?? createTestHubDb()
  if (!overrides.db) {
    seedHubFromConfig(db, config)
  }

  return buildApp({
    config,
    db,
    redis: overrides.redis ?? createTestRedis(),
  })
}

export function seedMinimalLocation(
  db: HubDb,
  config: HubConfig = testHubConfig,
) {
  seedHubFromConfig(db, config)
}
