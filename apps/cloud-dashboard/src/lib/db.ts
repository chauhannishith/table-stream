import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { count, eq } from 'drizzle-orm'
import { cloudSchema } from '@table-stream/shared-types/cloud'

function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? ''
}

function getSql() {
  const url = getDatabaseUrl()
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }
  return postgres(url, { max: 1 })
}

export async function checkDbHealth() {
  const url = getDatabaseUrl()
  if (!url) {
    return { ok: false as const, error: 'DATABASE_URL is not set' }
  }

  const client = getSql()
  try {
    await client`SELECT 1`
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Database unreachable',
    }
  } finally {
    await client.end()
  }
}

export async function getCloudSummary() {
  const health = await checkDbHealth()
  if (!health.ok) {
    throw new Error(health.error)
  }

  const sqlClient = getSql()
  const db = drizzle(sqlClient, { schema: cloudSchema })

  try {
    const [orgs] = await db
      .select({ value: count() })
      .from(cloudSchema.organizations)
    const [activeSubs] = await db
      .select({ value: count() })
      .from(cloudSchema.subscriptions)
      .where(eq(cloudSchema.subscriptions.status, 'ACTIVE'))
    const [syncRows] = await db
      .select({ value: count() })
      .from(cloudSchema.syncRecords)

    return {
      orgCount: orgs?.value ?? 0,
      activeSubscriptions: activeSubs?.value ?? 0,
      syncRecordCount: syncRows?.value ?? 0,
      dbHealthy: true,
    }
  } finally {
    await sqlClient.end()
  }
}
