import type { FastifyPluginAsync } from 'fastify'
import { listCategories } from '../services/menu-catalog.js'

export const menuCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/categories', async (request) => {
    const query = request.query as { include_inactive?: string }
    const includeInactive = query.include_inactive === 'true'

    return {
      categories: listCategories(app.hubDb, app.hubConfig.location_id, {
        includeInactive,
      }),
    }
  })
}
