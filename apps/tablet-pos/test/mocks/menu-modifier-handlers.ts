import { http, HttpResponse } from 'msw'
import {
  bumpModifierGroupSeq,
  bumpModifierOptionSeq,
  modifierGroups,
  modifierOptions,
  nowIso,
  type ModifierGroupRecord,
  type ModifierOptionRecord,
} from './stores'

export const menuModifierHandlers = [
  http.get('*/v1/menu/modifier-groups', ({ request }) => {
    const url = new URL(request.url)
    const includeInactive =
      url.searchParams.get('include_inactive') === 'true'
    const menuItemId = url.searchParams.get('menu_item_id')
    const categoryId = url.searchParams.get('category_id')
    const list = [...modifierGroups.values()].filter((group) => {
      if (!includeInactive && !group.is_active) return false
      if (menuItemId && group.menu_item_id !== menuItemId) return false
      if (categoryId && group.category_id !== categoryId) return false
      return true
    })
    return HttpResponse.json({ modifier_groups: list })
  }),

  http.post('*/v1/menu/modifier-groups', async ({ request }) => {
    const body = (await request.json()) as {
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
    if (!body.scope || !body.name?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'scope and name are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (body.scope === 'ITEM' && !body.menu_item_id) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'menu_item_id is required for ITEM scope',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (body.scope === 'CATEGORY' && !body.category_id) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'category_id is required for CATEGORY scope',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const group: ModifierGroupRecord = {
      id: `mg_${bumpModifierGroupSeq()}`,
      location_id: 'loc_test',
      scope: body.scope,
      category_id: body.category_id ?? null,
      menu_item_id: body.menu_item_id ?? null,
      name: body.name.trim(),
      min_select: body.min_select ?? 0,
      max_select: body.max_select ?? null,
      is_required: body.is_required ?? false,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      updated_at: nowIso(),
    }
    modifierGroups.set(group.id, group)
    return HttpResponse.json({ modifier_group: group }, { status: 201 })
  }),

  http.patch('*/v1/menu/modifier-groups/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = modifierGroups.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'modifier group not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      min_select?: number
      max_select?: number | null
      is_required?: boolean
      sort_order?: number
      is_active?: boolean
    }

    const group: ModifierGroupRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      min_select: body.min_select ?? existing.min_select,
      max_select:
        body.max_select !== undefined ? body.max_select : existing.max_select,
      is_required: body.is_required ?? existing.is_required,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    modifierGroups.set(id, group)
    return HttpResponse.json({ modifier_group: group })
  }),

  http.get('*/v1/menu/modifier-groups/:id/options', ({ params, request }) => {
    const groupId = String(params.id)
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...modifierOptions.values()].filter((option) => {
      if (option.group_id !== groupId) return false
      return includeInactive || option.is_active
    })
    return HttpResponse.json({ options: list })
  }),

  http.post(
    '*/v1/menu/modifier-groups/:id/options',
    async ({ params, request }) => {
      const groupId = String(params.id)
      if (!modifierGroups.has(groupId)) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'modifier group not found',
              details: { id: groupId },
            },
          },
          { status: 404 },
        )
      }

      const body = (await request.json()) as {
        code?: string
        label?: string
        price_cents?: number
        is_default?: boolean
        sort_order?: number
        is_active?: boolean
      }
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

      const option: ModifierOptionRecord = {
        id: `mo_${bumpModifierOptionSeq()}`,
        group_id: groupId,
        code: body.code.trim(),
        label: body.label.trim(),
        price_cents: body.price_cents ?? 0,
        is_default: body.is_default ?? false,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
        updated_at: nowIso(),
      }
      modifierOptions.set(option.id, option)
      return HttpResponse.json({ option }, { status: 201 })
    },
  ),

  http.patch('*/v1/menu/modifier-options/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = modifierOptions.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'modifier option not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      code?: string
      label?: string
      price_cents?: number
      is_default?: boolean
      sort_order?: number
      is_active?: boolean
    }

    const option: ModifierOptionRecord = {
      ...existing,
      code: body.code?.trim() || existing.code,
      label: body.label?.trim() || existing.label,
      price_cents: body.price_cents ?? existing.price_cents,
      is_default: body.is_default ?? existing.is_default,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    modifierOptions.set(id, option)
    return HttpResponse.json({ option })
  }),
]
