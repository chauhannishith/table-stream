import type { FastifyPluginAsync } from 'fastify'
import { runReadinessChecks } from '../services/health.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'edge-server',
    hub_id: app.hubConfig.hub_id,
    location_id: app.hubConfig.location_id,
    org_id: app.hubConfig.org_id,
    uptime_seconds: Math.floor(process.uptime()),
  }))

  app.get('/health/ready', async (request, reply) => {
    const result = await runReadinessChecks({
      db: app.hubDb,
      redis: app.redis,
    })

    const statusCode = result.checks.sqlite.ok ? 200 : 503
    return reply.status(statusCode).send({
      status: result.status,
      service: 'edge-server',
      checks: result.checks,
    })
  })
}
