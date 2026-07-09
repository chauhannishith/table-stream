import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createCategory,
  listCategories,
  updateCategory,
} from '../services/menu-catalog.js'

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

  app.post('/categories', async (request, reply) => {
    const body = request.body as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    if (!body?.name?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'name is required', 400)
    }

    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: body.name.trim(),
      ...pickDefined({
        sortOrder: body.sort_order,
        isActive: body.is_active,
      }),
    })

    return reply.status(201).send({ category })
  })

  app.patch('/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    const category = updateCategory(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        name: trimOptionalNonEmpty('name', body?.name),
        sortOrder: body?.sort_order,
        isActive: body?.is_active,
      }),
    )

    if (!category) {
      throw new AppError('NOT_FOUND', 'Category not found', 404, { id })
    }

    return reply.send({ category })
  })
}
