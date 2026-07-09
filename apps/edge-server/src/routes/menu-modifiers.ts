import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  createModifierGroupEntry,
  createModifierOptionEntry,
  listModifierGroupsForLocation,
  listModifierOptionsForGroup,
  updateModifierGroupEntry,
  updateModifierOptionEntry,
} from '../services/menu-catalog.js'

export const menuModifierRoutes: FastifyPluginAsync = async (app) => {
  app.get('/modifier-groups', async (request) => {
    const query = request.query as {
      category_id?: string
      menu_item_id?: string
      include_inactive?: string
    }

    return {
      modifier_groups: listModifierGroupsForLocation(
        app.hubDb,
        app.hubConfig.location_id,
        pickDefined({
          categoryId: query.category_id,
          menuItemId: query.menu_item_id,
          includeInactive: query.include_inactive === 'true',
        }),
      ),
    }
  })

  app.post('/modifier-groups', async (request, reply) => {
    const body = request.body as {
      scope?: 'CATEGORY' | 'ITEM'
      category_id?: string
      menu_item_id?: string
      name?: string
      min_select?: number
      max_select?: number | null
      is_required?: boolean
      sort_order?: number
      is_active?: boolean
    }

    if (!body?.scope || !body?.name?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'scope and name are required', 400)
    }

    const modifier_group = createModifierGroupEntry(
      app.hubDb,
      app.hubConfig.location_id,
      {
        scope: body.scope,
        name: body.name.trim(),
        ...pickDefined({
          categoryId: body.category_id,
          menuItemId: body.menu_item_id,
          minSelect: body.min_select,
          maxSelect: body.max_select,
          isRequired: body.is_required,
          sortOrder: body.sort_order,
          isActive: body.is_active,
        }),
      },
    )

    return reply.status(201).send({ modifier_group })
  })

  app.patch('/modifier-groups/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      min_select?: number
      max_select?: number | null
      is_required?: boolean
      sort_order?: number
      is_active?: boolean
    }

    const modifier_group = updateModifierGroupEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        name: body?.name?.trim(),
        minSelect: body?.min_select,
        maxSelect: body?.max_select,
        isRequired: body?.is_required,
        sortOrder: body?.sort_order,
        isActive: body?.is_active,
      }),
    )

    if (!modifier_group) {
      throw new AppError('NOT_FOUND', 'Modifier group not found', 404, { id })
    }

    return reply.send({ modifier_group })
  })

  app.get('/modifier-groups/:id/options', async (request) => {
    const { id } = request.params as { id: string }
    const query = request.query as { include_inactive?: string }

    return {
      options: listModifierOptionsForGroup(
        app.hubDb,
        app.hubConfig.location_id,
        id,
        { includeInactive: query.include_inactive === 'true' },
      ),
    }
  })

  app.post('/modifier-groups/:id/options', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      code?: string
      label?: string
      price_cents?: number
      is_default?: boolean
      sort_order?: number
      is_active?: boolean
    }

    if (!body?.code?.trim() || !body?.label?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'code and label are required', 400)
    }

    const option = createModifierOptionEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      {
        code: body.code.trim(),
        label: body.label.trim(),
        ...pickDefined({
          priceCents: body.price_cents,
          isDefault: body.is_default,
          sortOrder: body.sort_order,
          isActive: body.is_active,
        }),
      },
    )

    return reply.status(201).send({ option })
  })

  app.patch('/modifier-options/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      code?: string
      label?: string
      price_cents?: number
      is_default?: boolean
      sort_order?: number
      is_active?: boolean
    }

    const option = updateModifierOptionEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        code: body?.code?.trim(),
        label: body?.label?.trim(),
        priceCents: body?.price_cents,
        isDefault: body?.is_default,
        sortOrder: body?.sort_order,
        isActive: body?.is_active,
      }),
    )

    if (!option) {
      throw new AppError('NOT_FOUND', 'Modifier option not found', 404, { id })
    }

    return reply.send({ option })
  })
}
