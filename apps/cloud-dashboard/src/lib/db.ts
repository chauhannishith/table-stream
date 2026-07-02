import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { count, eq } from 'drizzle-orm'
import { cloudSchema } from '@table-stream/shared-types/cloud'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }
  return postgres(url, { max: 1 })
}

export async function getCloudSummary() {
  const sql = getSql()
  const db = drizzle(sql, { schema: cloudSchema })

  try {
    const [orgs] = await db.select({ value: count() }).from(cloudSchema.organizations)
    const [activeSubs] = await db
      .select({ value: count() })
      .from(cloudSchema.subscriptions)
      .where(eq(cloudSchema.subscriptions.status, 'ACTIVE'))
    const [syncRows] = await db.select({ value: count() }).from(cloudSchema.syncRecords)

    return {
      orgCount: orgs?.value ?? 0,
      activeSubscriptions: activeSubs?.value ?? 0,
      syncRecordCount: syncRows?.value ?? 0,
    }
  } finally {
    await sql.end()
  }
}
