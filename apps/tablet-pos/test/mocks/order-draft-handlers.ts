import { http, HttpResponse } from 'msw'
import {
  bumpOrderSeq,
  bumpTokenSeq,
  menuItems,
  menuItemZonePrices,
  nowIso,
  orders,
  recalcOrderTotals,
  zones,
  zonePriceKey,
  type OrderLineRecord,
  type OrderRecord,
} from './stores'

export const orderDraftHandlers = [
  http.post('*/v1/orders', async ({ request }) => {
    const body = (await request.json()) as {
      order_type?: string
      zone_id?: string
      table_id?: string
      customer_name?: string | null
      customer_contact?: string | null
    }

    if (body.order_type === 'TAKEAWAY') {
      const customerName = body.customer_name?.trim() ?? ''
      if (!body.zone_id || !customerName) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'zone_id and customer_name are required for TAKEAWAY',
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

      const order: OrderRecord = {
        id: `ord_${bumpOrderSeq()}`,
        location_id: 'loc_test',
        order_type: 'TAKEAWAY',
        table_id: null,
        zone_id: body.zone_id,
        token_number: null,
        customer_name: customerName,
        customer_contact: body.customer_contact?.trim() || null,
        status: 'DRAFT',
        fulfillment_status: 'IN_QUEUE',
        server_id: null,
        discount_type: null,
        discount_value: null,
        discount_cents: 0,
        service_charge_cents: 0,
        tip_cents: 0,
        version: 1,
        opened_at: nowIso(),
        closed_at: null,
        subtotal_cents: 0,
        tax_cents: 0,
        total_cents: 0,
        lines: [],
      }
      orders.set(order.id, order)
      return HttpResponse.json({ order }, { status: 201 })
    }

    return HttpResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Unsupported order_type in MSW stub',
          details: {},
        },
      },
      { status: 400 },
    )
  }),

  http.get('*/v1/orders/:id', ({ params }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }
    return HttpResponse.json({ order })
  }),

  http.post('*/v1/orders/:id/lines', async ({ params, request }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      menu_item_id?: string
      quantity?: number
    }
    if (!body.menu_item_id) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'menu_item_id is required',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const item = menuItems.get(body.menu_item_id)
    if (!item) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Menu item not found',
            details: { menu_item_id: body.menu_item_id },
          },
        },
        { status: 404 },
      )
    }

    const quantity = body.quantity ?? 1
    const zonePrice = order.zone_id
      ? menuItemZonePrices.get(zonePriceKey(item.id, order.zone_id))
      : undefined
    const unitPriceCents = zonePrice?.price_cents ?? item.base_price_cents
    const lineTotalCents = unitPriceCents * quantity
    const line: OrderLineRecord = {
      id: `line_${order.lines.length + 1}`,
      order_id: order.id,
      menu_item_id: item.id,
      name: item.name,
      quantity,
      unit_price_cents: unitPriceCents,
      tax_cents: 0,
      line_total_cents: lineTotalCents,
      modifiers: [],
      tags: [],
      special_instructions: null,
      kds_station_id: item.kds_station_id,
      status: 'DRAFT',
      is_submitted: false,
      submitted_at: null,
      submit_batch: 0,
      kds_visible: false,
      version: 1,
    }

    order.lines = [...order.lines, line]
    recalcOrderTotals(order)
    order.version += 1
    orders.set(order.id, order)

    return HttpResponse.json({ line }, { status: 201 })
  }),

  http.patch('*/v1/orders/:id/lines/:lineId', async ({ params, request }) => {
    const orderId = String(params.id)
    const lineId = String(params.lineId)
    const order = orders.get(orderId)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id: orderId },
          },
        },
        { status: 404 },
      )
    }

    const lineIndex = order.lines.findIndex((entry) => entry.id === lineId)
    if (lineIndex === -1) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order line not found',
            details: { line_id: lineId },
          },
        },
        { status: 404 },
      )
    }

    const existing = order.lines[lineIndex]!
    if (existing.is_submitted) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Submitted lines cannot be edited',
            details: { line_id: lineId },
          },
        },
        { status: 409 },
      )
    }

    const body = (await request.json()) as { quantity?: number }
    const quantity = body.quantity ?? existing.quantity
    if (quantity < 1) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'quantity must be at least 1',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const updated: OrderLineRecord = {
      ...existing,
      quantity,
      line_total_cents: existing.unit_price_cents * quantity,
      version: existing.version + 1,
    }
    order.lines = [
      ...order.lines.slice(0, lineIndex),
      updated,
      ...order.lines.slice(lineIndex + 1),
    ]
    recalcOrderTotals(order)
    order.version += 1
    orders.set(order.id, order)

    return HttpResponse.json({ line: updated })
  }),

  http.delete('*/v1/orders/:id/lines/:lineId', ({ params }) => {
    const orderId = String(params.id)
    const lineId = String(params.lineId)
    const order = orders.get(orderId)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id: orderId },
          },
        },
        { status: 404 },
      )
    }

    const lineIndex = order.lines.findIndex((entry) => entry.id === lineId)
    if (lineIndex === -1) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order line not found',
            details: { line_id: lineId },
          },
        },
        { status: 404 },
      )
    }

    const existing = order.lines[lineIndex]!
    if (existing.is_submitted) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Submitted lines cannot be removed',
            details: { line_id: lineId },
          },
        },
        { status: 409 },
      )
    }

    order.lines = order.lines.filter((entry) => entry.id !== lineId)
    recalcOrderTotals(order)
    order.version += 1
    orders.set(order.id, order)

    return HttpResponse.json({ ok: true })
  }),

  http.post('*/v1/orders/:id/submit', ({ params }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const drafts = order.lines.filter((line) => !line.is_submitted)
    if (drafts.length === 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No draft lines to submit',
            details: { order_id: id },
          },
        },
        { status: 400 },
      )
    }

    const submitBatch =
      Math.max(0, ...order.lines.map((line) => line.submit_batch)) + 1
    const submittedAt = nowIso()
    const submittedLines = drafts.map((line) => ({
      ...line,
      status: 'QUEUED',
      is_submitted: true,
      submitted_at: submittedAt,
      submit_batch: submitBatch,
      kds_visible: true,
      version: line.version + 1,
    }))

    order.lines = order.lines.map((line) => {
      const updated = submittedLines.find((entry) => entry.id === line.id)
      return updated ?? line
    })
    if (order.order_type === 'TAKEAWAY' && !order.token_number) {
      const token = bumpTokenSeq()
      order.token_number = `T-${String(token).padStart(3, '0')}`
    }
    order.status = order.status === 'DRAFT' ? 'SUBMITTED' : order.status
    order.version += 1
    orders.set(order.id, order)

    return HttpResponse.json({
      submission: {
        order,
        submit_batch: submitBatch,
        lines: submittedLines,
      },
    })
  }),
]
