import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createTag,
  listTags,
  updateTag,
} from '../services/menu-catalog.js'

export const menuTagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tags', async (request) => {
    const query = request.query as { include_inactive?: string }
    return {
      tags: listTags(app.hubDb, app.hubConfig.location_id, {
        includeInactive: query.include_inactive === 'true',
      }),
    }
  })

  app.post('/tags', async (request, reply) => {
    const body = request.body as {
      code?: string
      label?: string
      sort_order?: number
      is_active?: boolean
    }

    if (!body?.code?.trim() || !body?.label?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'code and label are required', 400)
    }

    const tag = createTag(app.hubDb, app.hubConfig.location_id, {
      code: body.code.trim(),
      label: body.label.trim(),
      ...pickDefined({
        sortOrder: body.sort_order,
        isActive: body.is_active,
      }),
    })

    return reply.status(201).send({ tag })
  })

  app.patch('/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      code?: string
      label?: string
      sort_order?: number
      is_active?: boolean
    }

    const tag = updateTag(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        code: trimOptionalNonEmpty('code', body?.code),
        label: trimOptionalNonEmpty('label', body?.label),
        sortOrder: body?.sort_order,
        isActive: body?.is_active,
      }),
    )

    if (!tag) {
      throw new AppError('NOT_FOUND', 'Tag not found', 404, { id })
    }

    return reply.send({ tag })
  })
}
