import { http, HttpResponse } from 'msw'
import {
  bumpTableSeq,
  bumpZoneSeq,
  floorTables,
  nowIso,
  parseTaxRules,
  zones,
  type FloorTableRecord,
  type ZoneRecord,
} from './stores'

export const floorHandlers = [
  http.get('*/v1/zones', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...zones.values()].filter(
      (zone) => includeInactive || zone.is_active,
    )
    return HttpResponse.json({ zones: list })
  }),

  http.post('*/v1/zones', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
      tax_rules?: unknown
    }
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

    const taxRules = parseTaxRules(body.tax_rules)
    if (!taxRules.ok) return taxRules.response

    const zone: ZoneRecord = {
      id: `zn_${bumpZoneSeq()}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      sort_order: body.sort_order ?? 0,
      tax_rules: taxRules.rules,
      is_active: body.is_active ?? true,
      updated_at: nowIso(),
    }
    zones.set(zone.id, zone)
    return HttpResponse.json({ zone }, { status: 201 })
  }),

  http.patch('*/v1/zones/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = zones.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Zone not found',
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
      tax_rules?: unknown
    }

    let tax_rules = existing.tax_rules
    if (body.tax_rules !== undefined) {
      const parsed = parseTaxRules(body.tax_rules)
      if (!parsed.ok) return parsed.response
      tax_rules = parsed.rules
    }

    const zone: ZoneRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active ?? existing.is_active,
      tax_rules,
      updated_at: nowIso(),
    }
    zones.set(id, zone)
    return HttpResponse.json({ zone })
  }),

  http.get('*/v1/tables', ({ request }) => {
    const zoneId = new URL(request.url).searchParams.get('zone_id')
    const list = [...floorTables.values()].filter(
      (table) => !zoneId || table.zone_id === zoneId,
    )
    return HttpResponse.json({ tables: list })
  }),

  http.post('*/v1/tables', async ({ request }) => {
    const body = (await request.json()) as {
      zone_id?: string
      label?: string
      capacity?: number
      pos_x?: number | null
      pos_y?: number | null
    }
    if (!body.zone_id || !body.label?.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'zone_id and label are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (!zones.has(body.zone_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Zone not found',
            details: { zone_id: body.zone_id },
          },
        },
        { status: 404 },
      )
    }

    const table: FloorTableRecord = {
      id: `tbl_${bumpTableSeq()}`,
      location_id: 'loc_test',
      zone_id: body.zone_id,
      label: body.label.trim(),
      capacity: body.capacity ?? 2,
      pos_x: body.pos_x ?? null,
      pos_y: body.pos_y ?? null,
      status: 'AVAILABLE',
      version: 1,
      updated_at: nowIso(),
    }
    floorTables.set(table.id, table)
    return HttpResponse.json({ table }, { status: 201 })
  }),
  http.patch('*/v1/tables/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = floorTables.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Table not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      zone_id?: string
      label?: string
      capacity?: number
      pos_x?: number | null
      pos_y?: number | null
      status?: FloorTableRecord['status']
    }

    if (body.zone_id !== undefined && !zones.has(body.zone_id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Zone not found',
            details: { zone_id: body.zone_id },
          },
        },
        { status: 404 },
      )
    }

    const table: FloorTableRecord = {
      ...existing,
      zone_id: body.zone_id ?? existing.zone_id,
      label: body.label?.trim() || existing.label,
      capacity: body.capacity ?? existing.capacity,
      pos_x: body.pos_x !== undefined ? body.pos_x : existing.pos_x,
      pos_y: body.pos_y !== undefined ? body.pos_y : existing.pos_y,
      status: body.status ?? existing.status,
      version: existing.version + 1,
      updated_at: nowIso(),
    }
    floorTables.set(id, table)
    return HttpResponse.json({ table })
  }),
]
