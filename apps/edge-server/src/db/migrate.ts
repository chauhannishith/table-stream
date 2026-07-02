import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { loadHubConfig } from '../config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function migrate() {
  const config = loadHubConfig()
  const dbPath = join(config.data_dir, 'hub.sqlite')
  const sqlite = new Database(dbPath)
  const candidates = [
    join(__dirname, 'migrations', '0001_initial.sql'),
    join(__dirname, '..', '..', 'src', 'db', 'migrations', '0001_initial.sql'),
  ]
  const migrationFile = candidates.find((p) => existsSync(p))
  if (!migrationFile) {
    throw new Error('Migration 0001_initial.sql not found')
  }
  const sql = readFileSync(migrationFile, 'utf8')
  sqlite.exec(sql)
  console.log(`Migrated hub SQLite at ${dbPath}`)
}

const script = process.argv[1]
if (
  script &&
  (script.endsWith('migrate.ts') || script.endsWith('migrate.js'))
) {
  migrate()
}
