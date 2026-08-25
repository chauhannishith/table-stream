import { http, HttpResponse } from 'msw'
import {
  bumpCategorySeq,
  bumpMenuItemSeq,
  bumpMenuTagSeq,
  categories,
  menuItems,
  menuItemZonePrices,
  menuTags,
  nowIso,
  zonePriceKey,
  zones,
  type CategoryRecord,
  type MenuItemRecord,
  type MenuTagRecord,
} from './stores'

export const menuCatalogHandlers = [
  http.get('*/v1/menu/categories', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...categories.values()].filter(
      (category) => includeInactive || category.is_active,
    )
    return HttpResponse.json({ categories: list })
  }),

  http.post('*/v1/menu/categories', async ({ request }) => {
    const body = (await request.json()) as { name?: string }
    if (!body.name?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const category: CategoryRecord = {
      id: `cat_${bumpCategorySeq()}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      sort_order: 0,
      is_active: true,
      updated_at: nowIso(),
    }
    categories.set(category.id, category)
    return HttpResponse.json({ category }, { status: 201 })
  }),

  http.patch('*/v1/menu/categories/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = categories.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    const category: CategoryRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    categories.set(id, category)
    return HttpResponse.json({ category })
  }),

  http.get('*/v1/menu/items', ({ request }) => {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('include_inactive') === 'true'
    const zoneId = url.searchParams.get('zone_id')
    const list = [...menuItems.values()]
      .filter((item) => includeInactive || item.is_active)
      .map((item) => {
        if (!zoneId) return item
        const override = menuItemZonePrices.get(zonePriceKey(item.id, zoneId))
        return {
          ...item,
          unit_price_cents: override?.price_cents ?? item.base_price_cents,
        }
      })
    return HttpResponse.json({ items: list })
  }),

  http.put('*/v1/menu/items/:id/zone-prices', async ({ params, request }) => {
    const id = String(params.id)
    const existing = menuItems.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Menu item not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      prices?: Array<{ zone_id: string; price_cents: number }>
    }
    if (!Array.isArray(body?.prices)) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'prices array is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    for (const price of body.prices) {
      if (!zones.has(price.zone_id)) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Zone not found',
              details: { zone_id: price.zone_id },
            },
          },
          { status: 404 },
        )
      }
      menuItemZonePrices.set(zonePriceKey(id, price.zone_id), {
        zone_id: price.zone_id,
        price_cents: price.price_cents,
        updated_at: nowIso(),
      })
    }

    const prices = [...menuItemZonePrices.entries()]
      .filter(([key]) => key.startsWith(`${id}:`))
      .map(([, row]) => row)
    return HttpResponse.json({ prices })
  }),

  http.post('*/v1/menu/items', async ({ request }) => {
    const body = (await request.json()) as {
      category_id?: string
      name?: string
      base_price_cents?: number
      is_active?: boolean
    }
    if (!body.category_id || !body.name?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'category_id and name are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (typeof body.base_price_cents !== 'number') {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'base_price_cents is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (!categories.has(body.category_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found',
            details: { category_id: body.category_id },
          },
        },
        { status: 404 },
      )
    }

    const item: MenuItemRecord = {
      id: `mi_${bumpMenuItemSeq()}`,
      location_id: 'loc_test',
      category_id: body.category_id,
      name: body.name.trim(),
      base_price_cents: body.base_price_cents,
      unit_price_cents: body.base_price_cents,
      kds_station_id: null,
      is_active: body.is_active ?? true,
      tag_ids: [],
      updated_at: nowIso(),
    }
    menuItems.set(item.id, item)
    return HttpResponse.json({ item }, { status: 201 })
  }),

  http.patch('*/v1/menu/items/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = menuItems.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Menu item not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      category_id?: string
      name?: string
      base_price_cents?: number
      is_active?: boolean
    }

    if (body.category_id && !categories.has(body.category_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found',
            details: { category_id: body.category_id },
          },
        },
        { status: 404 },
      )
    }

    const base_price_cents =
      body.base_price_cents ?? existing.base_price_cents
    const item: MenuItemRecord = {
      ...existing,
      category_id: body.category_id ?? existing.category_id,
      name: body.name?.trim() || existing.name,
      base_price_cents,
      unit_price_cents: base_price_cents,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    menuItems.set(id, item)
    return HttpResponse.json({ item })
  }),

  http.get('*/v1/menu/tags', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...menuTags.values()].filter(
      (tag) => includeInactive || tag.is_active,
    )
    return HttpResponse.json({ tags: list })
  }),

  http.post('*/v1/menu/tags', async ({ request }) => {
    const body = (await request.json()) as { code?: string; label?: string }
    if (!body.code?.trim() || !body.label?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'code and label are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const code = body.code.trim()
    const duplicate = [...menuTags.values()].some((tag) => tag.code === code)
    if (duplicate) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Tag code already exists',
            details: { code },
          },
        },
        { status: 409 },
      )
    }

    const tag: MenuTagRecord = {
      id: `tag_${bumpMenuTagSeq()}`,
      location_id: 'loc_test',
      code,
      label: body.label.trim(),
      sort_order: 0,
      is_active: true,
      updated_at: nowIso(),
    }
    menuTags.set(tag.id, tag)
    return HttpResponse.json({ tag }, { status: 201 })
  }),

  http.patch('*/v1/menu/tags/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = menuTags.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Tag not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      code?: string
      label?: string
      sort_order?: number
      is_active?: boolean
    }

    const code = body.code?.trim() || existing.code
    const duplicate = [...menuTags.values()].some(
      (tag) => tag.id !== id && tag.code === code,
    )
    if (duplicate) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Tag code already exists',
            details: { code },
          },
        },
        { status: 409 },
      )
    }

    const tag: MenuTagRecord = {
      ...existing,
      code,
      label: body.label?.trim() || existing.label,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    menuTags.set(id, tag)
    return HttpResponse.json({ tag })
  }),
]
