import { http, HttpResponse } from 'msw'
import {
  bumpInvoiceSeq,
  bumpPaymentSeq,
  capturedPayments,
  computeMswBillPreview,
  invoiceByOrder,
  invoices,
  nowIso,
  orders,
  type CapturedPaymentRecord,
  type InvoiceRecord,
} from './stores'

export const orderCheckoutHandlers = [
  http.post('*/v1/orders/:id/bill/preview', async ({ params, request }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { order_id: id },
          },
        },
        { status: 404 },
      )
    }
    if (order.status === 'PAID' || order.status === 'VOID') {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Cannot bill a closed order',
            details: { order_id: id, status: order.status },
          },
        },
        { status: 409 },
      )
    }

    const body = (await request.json()) as {
      discount_type?: string
      discount_value?: number
      tip_cents?: number
    }
    return HttpResponse.json({
      preview: computeMswBillPreview(order, body),
    })
  }),

  http.post('*/v1/orders/:id/bill', async ({ params, request }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { order_id: id },
          },
        },
        { status: 404 },
      )
    }
    if (order.status === 'PAID' || order.status === 'VOID') {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Cannot bill a closed order',
            details: { order_id: id, status: order.status },
          },
        },
        { status: 409 },
      )
    }

    const body = (await request.json()) as {
      discount_type?: string
      discount_value?: number
      tip_cents?: number
    }
    const preview = computeMswBillPreview(order, body)
    order.discount_type =
      body.discount_type === 'PERCENT' || body.discount_type === 'FIXED'
        ? body.discount_type
        : null
    order.discount_value =
      body.discount_value !== undefined ? body.discount_value : null
    order.discount_cents = preview.discount_cents
    order.service_charge_cents = preview.service_charge_cents
    order.tip_cents = preview.tip_cents
    order.subtotal_cents = preview.subtotal_cents
    order.tax_cents = preview.tax_cents
    order.total_cents = preview.total_cents
    order.status = 'CHECK_PRINTED'
    order.version += 1
    orders.set(order.id, order)

    return HttpResponse.json({ order })
  }),

  http.post('*/v1/orders/:id/payments', async ({ params, request }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { order_id: id },
          },
        },
        { status: 404 },
      )
    }
    if (order.status === 'PAID' || order.status === 'VOID') {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Order is already closed',
            details: { order_id: id, status: order.status },
          },
        },
        { status: 409 },
      )
    }
    if (order.status !== 'CHECK_PRINTED') {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Order must be billed before recording payment',
            details: { order_id: id, status: order.status },
          },
        },
        { status: 400 },
      )
    }

    const body = (await request.json()) as {
      tender_type?: string
      amount_cents?: number
    }
    if (
      body.tender_type !== 'CASH' &&
      body.tender_type !== 'CARD' &&
      body.tender_type !== 'OTHER'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid tender_type',
            details: { tender_type: body.tender_type },
          },
        },
        { status: 400 },
      )
    }

    const amountCents = body.amount_cents ?? order.total_cents
    if (amountCents !== order.total_cents) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Payment amount must match order total',
            details: {
              amount_cents: amountCents,
              order_total_cents: order.total_cents,
            },
          },
        },
        { status: 400 },
      )
    }

    order.status = 'PAID'
    order.closed_at = nowIso()
    order.version += 1
    orders.set(order.id, order)

    const payment: CapturedPaymentRecord = {
      id: `pay_${bumpPaymentSeq()}`,
      order_id: order.id,
      tender_type: body.tender_type,
      amount_cents: amountCents,
    }
    capturedPayments.set(order.id, payment)

    return HttpResponse.json({
      payment: {
        id: payment.id,
        order_id: order.id,
        status: 'CAPTURED',
        amount_cents: amountCents,
        tender_type: body.tender_type,
        provider: null,
        provider_ref: null,
        version: 1,
        created_at: nowIso(),
      },
      order,
    })
  }),

  http.post('*/v1/orders/:id/invoice', ({ params }) => {
    const id = String(params.id)
    const order = orders.get(id)
    if (!order) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            details: { order_id: id },
          },
        },
        { status: 404 },
      )
    }
    if (order.status !== 'PAID') {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Order must be paid before issuing invoice',
            details: { order_id: id, status: order.status },
          },
        },
        { status: 400 },
      )
    }

    const existingId = invoiceByOrder.get(id)
    if (existingId) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Invoice already issued for this order',
            details: { order_id: id, invoice_id: existingId },
          },
        },
        { status: 409 },
      )
    }

    const payment = capturedPayments.get(id)
    if (!payment) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Captured payment required to issue invoice',
            details: { order_id: id },
          },
        },
        { status: 400 },
      )
    }

    const invoiceSeqValue = bumpInvoiceSeq()
    const invoiceId = `inv_${invoiceSeqValue}`
    const invoiceNumber = `INV-${String(invoiceSeqValue).padStart(5, '0')}`
    const invoice: InvoiceRecord = {
      id: invoiceId,
      location_id: order.location_id,
      order_id: order.id,
      payment_id: payment.id,
      invoice_number: invoiceNumber,
      status: 'ISSUED',
      issued_at: nowIso(),
      voided_at: null,
      void_reason: null,
      replaces_invoice_id: null,
      subtotal_cents: order.subtotal_cents,
      tax_cents: order.tax_cents,
      discount_cents: order.discount_cents,
      tip_cents: order.tip_cents,
      total_cents: order.total_cents,
      tender_summary: {
        [payment.tender_type.toLowerCase()]: payment.amount_cents,
      },
      line_items: order.lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        line_total_cents: line.line_total_cents,
      })),
      cashier_id: null,
      cashier_name: 'Counter',
      token_number: order.token_number ?? '',
      business_snapshot: {
        legal_name: 'Unknown Business',
        trade_name: null,
        gst_number: null,
        address_lines: {},
        phone: null,
        email: null,
        logo_path: null,
      },
      tax_breakdown:
        order.tax_cents > 0 ? { tax: order.tax_cents } : {},
      applied_tax_rules: {},
      combined_rate_percent: 0,
      metadata: {
        order_type: order.order_type,
        customer_name: order.customer_name,
      },
      document_path: `/invoices/${order.location_id}/${invoiceId}.pdf`,
      content_hash: `hash_${invoiceId}`,
    }
    invoices.set(invoiceId, invoice)
    invoiceByOrder.set(id, invoiceId)

    return HttpResponse.json({ invoice })
  }),

  http.get('*/v1/invoices/:id', ({ params }) => {
    const id = String(params.id)
    const invoice = invoices.get(id)
    if (!invoice) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
            details: { invoice_id: id },
          },
        },
        { status: 404 },
      )
    }
    return HttpResponse.json({ invoice })
  }),
]
