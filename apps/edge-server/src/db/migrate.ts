import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { loadHubConfig } from '../config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function migrationsDir() {
  const candidates = [
    join(__dirname, 'migrations'),
    join(__dirname, '..', '..', 'src', 'db', 'migrations'),
  ]
  const dir = candidates.find((p) => existsSync(p))
  if (!dir) {
    throw new Error('Migrations directory not found')
  }
  return dir
}

type SqliteDatabase = InstanceType<typeof Database>

export function applyMigrationsToSqlite(sqlite: SqliteDatabase) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    (
      sqlite.prepare('SELECT id FROM schema_migrations').all() as Array<{
        id: string
      }>
    ).map((row) => row.id),
  )

  const files = readdirSync(migrationsDir())
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir(), file), 'utf8')
    sqlite.exec(sql)
    sqlite.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file)
    console.log(`Applied migration ${file}`)
  }
}

export function migrate() {
  const config = loadHubConfig()
  const dbPath = join(config.data_dir, 'hub.sqlite')
  const sqlite = new Database(dbPath)
  applyMigrationsToSqlite(sqlite)
  console.log(`Hub SQLite ready at ${dbPath}`)
}

const script = process.argv[1]
if (
  script &&
  (script.endsWith('migrate.ts') || script.endsWith('migrate.js'))
) {
  migrate()
}
