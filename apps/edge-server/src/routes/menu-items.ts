import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import {
  createMenuItemEntry,
  listMenuForZone,
  setMenuItemZonePrices,
  updateMenuItemEntry,
} from '../services/menu-catalog.js'

export const menuItemRoutes: FastifyPluginAsync = async (app) => {
  app.get('/items', async (request) => {
    const query = request.query as {
      zone_id?: string
      include_inactive?: string
    }

    return {
      items: listMenuForZone(
        app.hubDb,
        app.hubConfig.location_id,
        query.zone_id,
        { includeInactive: query.include_inactive === 'true' },
      ),
    }
  })

  app.post('/items', async (request, reply) => {
    const body = request.body as {
      category_id?: string
      name?: string
      base_price_cents?: number
      kds_station_id?: string | null
      is_active?: boolean
      tag_ids?: string[]
    }

    if (!body?.category_id || !body?.name?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'category_id and name are required',
        400,
      )
    }
    if (typeof body.base_price_cents !== 'number') {
      throw new AppError('VALIDATION_ERROR', 'base_price_cents is required', 400)
    }

    const item = createMenuItemEntry(app.hubDb, app.hubConfig.location_id, {
      categoryId: body.category_id,
      name: body.name.trim(),
      basePriceCents: body.base_price_cents,
      ...pickDefined({
        kdsStationId: body.kds_station_id,
        isActive: body.is_active,
        tagIds: body.tag_ids,
      }),
    })

    return reply.status(201).send({ item })
  })

  app.patch('/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      category_id?: string
      name?: string
      base_price_cents?: number
      kds_station_id?: string | null
      is_active?: boolean
      tag_ids?: string[]
    }

    const item = updateMenuItemEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        categoryId: body?.category_id,
        name: body?.name?.trim(),
        basePriceCents: body?.base_price_cents,
        kdsStationId: body?.kds_station_id,
        isActive: body?.is_active,
        tagIds: body?.tag_ids,
      }),
    )

    if (!item) {
      throw new AppError('NOT_FOUND', 'Menu item not found', 404, { id })
    }

    return reply.send({ item })
  })

  app.put('/items/:id/zone-prices', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      prices?: Array<{ zone_id: string; price_cents: number }>
    }

    if (!Array.isArray(body?.prices)) {
      throw new AppError('VALIDATION_ERROR', 'prices array is required', 400)
    }

    const prices = setMenuItemZonePrices(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      body.prices.map((price) => ({
        zoneId: price.zone_id,
        priceCents: price.price_cents,
      })),
    )

    return reply.send({ prices })
  })
}
