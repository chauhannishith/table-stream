import type { FastifyPluginAsync } from 'fastify'
import { buildFullHubExport } from '../services/hub-export.js'

/** Read-only local archive export (JSON MVP; Excel later). Allowed when suspended. */
export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/export/full', async () => {
    return buildFullHubExport(app.hubDb, app.hubConfig)
  })
}
