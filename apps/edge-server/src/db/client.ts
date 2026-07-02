import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { hubSchema } from '@table-stream/shared-types/hub'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { HubConfig } from './config.js'

export function createHubDb(config: HubConfig) {
  mkdirSync(config.data_dir, { recursive: true })
  const dbPath = join(config.data_dir, 'hub.sqlite')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema: hubSchema })
}

export type HubDb = ReturnType<typeof createHubDb>
