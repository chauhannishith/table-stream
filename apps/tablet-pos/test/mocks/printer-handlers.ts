import { http, HttpResponse } from 'msw'
import {
  bumpPrinterSeq,
  getPrintConfig,
  nowIso,
  printers,
  setPrintConfig,
  type PrintConfigRecord,
  type PrinterRecord,
} from './stores'

export const printerHandlers = [
  http.get('*/v1/printers', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...printers.values()].filter(
      (printer) => includeInactive || printer.is_active,
    )
    return HttpResponse.json({ printers: list })
  }),

  http.post('*/v1/printers', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string
      role?: string
      connection?: Record<string, unknown>
      kds_station_ids?: string[] | null
      is_active?: boolean
    }
    if (!body.name?.trim() || !body.role) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name and role are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (
      body.role !== 'ORDERING' &&
      body.role !== 'KITCHEN' &&
      body.role !== 'COLLECTION'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid printer role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }

    const printer: PrinterRecord = {
      id: `prn_${bumpPrinterSeq()}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      role: body.role,
      connection: body.connection ?? {},
      kds_station_ids: body.kds_station_ids ?? null,
      is_active: body.is_active ?? true,
      updated_at: nowIso(),
    }
    printers.set(printer.id, printer)
    return HttpResponse.json({ printer }, { status: 201 })
  }),

  http.patch('*/v1/printers/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = printers.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Printer not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      role?: string
      connection?: Record<string, unknown>
      kds_station_ids?: string[] | null
      is_active?: boolean
    }

    if (
      body.role !== undefined &&
      body.role !== 'ORDERING' &&
      body.role !== 'KITCHEN' &&
      body.role !== 'COLLECTION'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid printer role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }

    const printer: PrinterRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      role: (body.role as PrinterRecord['role'] | undefined) ?? existing.role,
      connection: body.connection ?? existing.connection,
      kds_station_ids:
        body.kds_station_ids !== undefined
          ? body.kds_station_ids
          : existing.kds_station_ids,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    printers.set(id, printer)
    return HttpResponse.json({ printer })
  }),

  http.get('*/v1/location/print-config', () =>
    HttpResponse.json({ print_config: getPrintConfig() }),
  ),

  http.put('*/v1/location/print-config', async ({ request }) => {
    const body = (await request.json()) as { print_stages?: unknown }
    if (body.print_stages === undefined) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'print_stages is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const stages = body.print_stages as PrintConfigRecord['print_stages']
    if (
      !stages?.ordering ||
      !stages?.kitchen ||
      !stages?.collection ||
      typeof stages.ordering.enabled !== 'boolean' ||
      typeof stages.kitchen.enabled !== 'boolean' ||
      typeof stages.collection.enabled !== 'boolean'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid print_stages config',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const nextPrint = {
      location_id: 'loc_test',
      print_stages: stages,
      updated_at: nowIso(),
    }
    setPrintConfig(nextPrint)
    return HttpResponse.json({ print_config: nextPrint })
  }),
]
