import type { FastifyPluginAsync } from 'fastify'

export const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    const entitled = process.env.HUB_ENTITLED !== 'false'
    return {
      hub_status: entitled ? 'ACTIVE' : 'SUSPENDED',
      cloud_sync_enabled: app.hubConfig.cloud_sync_enabled,
      subscription_status: process.env.SUBSCRIPTION_STATUS ?? 'ACTIVE',
    }
  })
}
