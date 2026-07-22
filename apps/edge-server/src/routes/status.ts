import type { FastifyPluginAsync } from 'fastify'
import { getEffectiveHubStatus } from '../lib/hub-guard.js'
import { getHubIdentity } from '../services/hub-seed.js'
import { getLatestSchemaVersion } from '../lib/schema-version.js'
import { checkSqlite } from '../services/health.js'

export const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    const identity = getHubIdentity(app.hubDb, app.hubConfig)
    const hubStatus = getEffectiveHubStatus(
      app.hubDb,
      app.hubConfig.location_id,
    )
    const sqlite = checkSqlite(app.hubDb)
    const schemaVersion = getLatestSchemaVersion(app.hubDb)

    return {
      hub_status: hubStatus,
      cloud_sync_enabled:
        identity?.cloud_sync_enabled ?? app.hubConfig.cloud_sync_enabled,
      subscription_status: process.env.SUBSCRIPTION_STATUS ?? 'ACTIVE',
      location_name: identity?.location_name ?? app.hubConfig.location_name,
      org_id: identity?.org_id ?? app.hubConfig.org_id,
      location_id: identity?.location_id ?? app.hubConfig.location_id,
      hub_id: identity?.hub_id ?? app.hubConfig.hub_id,
      db_ready: sqlite.ok,
      schema_version: schemaVersion,
    }
  })
}
