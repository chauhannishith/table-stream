import { describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import {
  createTakeawayOrder,
  normalizeCustomerName,
  removeOrderLine,
  submitOrder,
  updateOrderLine,
} from './orders-api'
import {
  finalizeOrderBill,
  getInvoice,
  issueOrderInvoice,
  previewOrderBill,
  recordOrderPayment,
} from './order-checkout-api'

const sampleLine = {
  id: 'line_1',
  order_id: 'ord_1',
  menu_item_id: 'mi_1',
  name: 'Burger',
  quantity: 2,
  unit_price_cents: 650,
  tax_cents: 0,
  line_total_cents: 1300,
  modifiers: [],
  tags: [],
  special_instructions: null,
  kds_station_id: null,
  status: 'DRAFT',
  is_submitted: false,
  submitted_at: null,
  submit_batch: 0,
  kds_visible: false,
  version: 1,
}

const sampleOrder = {
  id: 'ord_1',
  location_id: 'loc_test',
  order_type: 'TAKEAWAY' as const,
  table_id: null,
  zone_id: 'zn_1',
  token_number: null,
  customer_name: 'Alex',
  customer_contact: null,
  status: 'DRAFT' as const,
  fulfillment_status: 'IN_QUEUE' as const,
  server_id: null,
  discount_type: null,
  discount_value: null,
  discount_cents: 0,
  service_charge_cents: 0,
  tip_cents: 0,
  version: 1,
  opened_at: '2026-07-27T00:00:00.000Z',
  closed_at: null,
  subtotal_cents: 0,
  tax_cents: 0,
  total_cents: 0,
  lines: [],
}

describe('normalizeCustomerName', () => {
  it('trims and rejects blank names', () => {
    expect(normalizeCustomerName('  Alex  ')).toBe('Alex')
    expect(() => normalizeCustomerName('   ')).toThrow(/required/)
  })
})

describe('orders API helpers', () => {
  it('creates a takeaway order', async () => {
    const client = {
      post: vi.fn(async () => ({ order: sampleOrder })),
    } as unknown as HubApiClient

    await expect(
      createTakeawayOrder(
        { zone_id: 'zn_1', customer_name: ' Alex ' },
        client,
      ),
    ).resolves.toEqual(sampleOrder)
    expect(client.post).toHaveBeenCalledWith('/v1/orders', {
      body: {
        order_type: 'TAKEAWAY',
        zone_id: 'zn_1',
        customer_name: 'Alex',
      },
    })
  })

  it('includes optional customer_contact', async () => {
    const client = {
      post: vi.fn(async () => ({
        order: { ...sampleOrder, customer_contact: '555-0100' },
      })),
    } as unknown as HubApiClient

    await expect(
      createTakeawayOrder(
        {
          zone_id: 'zn_1',
          customer_name: 'Alex',
          customer_contact: ' 555-0100 ',
        },
        client,
      ),
    ).resolves.toMatchObject({ customer_contact: '555-0100' })
    expect(client.post).toHaveBeenCalledWith('/v1/orders', {
      body: {
        order_type: 'TAKEAWAY',
        zone_id: 'zn_1',
        customer_name: 'Alex',
        customer_contact: '555-0100',
      },
    })
  })

  it('surfaces hub NOT_FOUND for unknown zone_id', async () => {
    const client = {
      post: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'NOT_FOUND',
            message: 'Zone not found',
            details: { zone_id: 'zone_missing' },
          },
          404,
        )
      }),
    } as unknown as HubApiClient

    await expect(
      createTakeawayOrder(
        { zone_id: 'zone_missing', customer_name: 'Alex' },
        client,
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Zone not found',
      status: 404,
    })
  })

  it('updates a draft order line quantity', async () => {
    const client = {
      patch: vi.fn(async () => ({ line: { ...sampleLine, quantity: 3 } })),
    } as unknown as HubApiClient

    await expect(
      updateOrderLine('ord_1', 'line_1', { quantity: 3 }, client),
    ).resolves.toMatchObject({ quantity: 3 })
    expect(client.patch).toHaveBeenCalledWith('/v1/orders/ord_1/lines/line_1', {
      body: { quantity: 3 },
    })
  })

  it('removes a draft order line', async () => {
    const client = {
      delete: vi.fn(async () => undefined),
    } as unknown as HubApiClient

    await expect(removeOrderLine('ord_1', 'line_1', client)).resolves.toBeUndefined()
    expect(client.delete).toHaveBeenCalledWith('/v1/orders/ord_1/lines/line_1')
  })

  it('submits draft lines and returns token on takeaway order', async () => {
    const submission = {
      order: {
        ...sampleOrder,
        status: 'SUBMITTED' as const,
        token_number: 'T-001',
      },
      submit_batch: 1,
      lines: [{ ...sampleLine, is_submitted: true }],
    }
    const client = {
      post: vi.fn(async () => ({ submission })),
    } as unknown as HubApiClient

    await expect(
      submitOrder('ord_1', { idempotencyKey: 'submit-1' }, client),
    ).resolves.toEqual(submission)
    expect(client.post).toHaveBeenCalledWith('/v1/orders/ord_1/submit', {
      headers: { 'Idempotency-Key': 'submit-1' },
    })
  })

  it('surfaces hub VALIDATION_ERROR when no draft lines', async () => {
    const client = {
      post: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'VALIDATION_ERROR',
            message: 'No draft lines to submit',
            details: { order_id: 'ord_1' },
          },
          400,
        )
      }),
    } as unknown as HubApiClient

    await expect(submitOrder('ord_1', {}, client)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'No draft lines to submit',
      status: 400,
    })
  })

  it('previews bill totals with discount and tip', async () => {
    const preview = {
      subtotal_cents: 10000,
      discount_cents: 1000,
      discounted_subtotal_cents: 9000,
      tax_cents: 450,
      tax_breakdown: { cgst: 225, sgst: 225 },
      service_charge_cents: 0,
      tip_cents: 500,
      total_cents: 9950,
    }
    const client = {
      post: vi.fn(async () => ({ preview })),
    } as unknown as HubApiClient

    await expect(
      previewOrderBill(
        'ord_1',
        { discount_type: 'PERCENT', discount_value: 10, tip_cents: 500 },
        client,
      ),
    ).resolves.toEqual(preview)
    expect(client.post).toHaveBeenCalledWith('/v1/orders/ord_1/bill/preview', {
      body: {
        discount_type: 'PERCENT',
        discount_value: 10,
        tip_cents: 500,
      },
    })
  })

  it('finalizes bill and returns locked order', async () => {
    const billed = {
      ...sampleOrder,
      status: 'CHECK_PRINTED' as const,
      tip_cents: 200,
      total_cents: 850,
    }
    const client = {
      post: vi.fn(async () => ({ order: billed })),
    } as unknown as HubApiClient

    await expect(
      finalizeOrderBill('ord_1', { tip_cents: 200 }, client),
    ).resolves.toEqual(billed)
    expect(client.post).toHaveBeenCalledWith('/v1/orders/ord_1/bill', {
      body: { tip_cents: 200 },
    })
  })

  it('records payment for a billed order', async () => {
    const paid = {
      payment: {
        id: 'pay_1',
        order_id: 'ord_1',
        status: 'CAPTURED',
        amount_cents: 850,
        tender_type: 'CASH' as const,
        provider: null,
        provider_ref: null,
        version: 1,
        created_at: '2026-07-27T00:00:00.000Z',
      },
      order: { ...sampleOrder, status: 'PAID' as const, total_cents: 850 },
    }
    const client = {
      post: vi.fn(async () => paid),
    } as unknown as HubApiClient

    await expect(
      recordOrderPayment('ord_1', { tender_type: 'CASH' }, client),
    ).resolves.toEqual(paid)
    expect(client.post).toHaveBeenCalledWith('/v1/orders/ord_1/payments', {
      body: { tender_type: 'CASH' },
    })
  })

  it('surfaces hub VALIDATION_ERROR when order is not billed', async () => {
    const client = {
      post: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'VALIDATION_ERROR',
            message: 'Order must be billed before recording payment',
            details: { order_id: 'ord_1', status: 'DRAFT' },
          },
          400,
        )
      }),
    } as unknown as HubApiClient

    await expect(
      recordOrderPayment('ord_1', { tender_type: 'CARD' }, client),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Order must be billed before recording payment',
      status: 400,
    })
  })

  it('issues an invoice for a paid order', async () => {
    const invoice = {
      id: 'inv_1',
      invoice_number: 'INV-00001',
      order_id: 'ord_1',
      tax_breakdown: { cgst: 25, sgst: 25 },
      business_snapshot: { legal_name: 'Unknown Business' },
    }
    const client = {
      post: vi.fn(async () => ({ invoice })),
    } as unknown as HubApiClient

    await expect(issueOrderInvoice('ord_1', client)).resolves.toMatchObject({
      invoice_number: 'INV-00001',
    })
    expect(client.post).toHaveBeenCalledWith('/v1/orders/ord_1/invoice', {
      body: {},
    })
  })

  it('loads an invoice snapshot for reprint', async () => {
    const invoice = {
      id: 'inv_1',
      invoice_number: 'INV-00001',
      content_hash: 'abc',
    }
    const client = {
      get: vi.fn(async () => ({ invoice })),
    } as unknown as HubApiClient

    await expect(getInvoice('inv_1', client)).resolves.toMatchObject({
      invoice_number: 'INV-00001',
    })
    expect(client.get).toHaveBeenCalledWith('/v1/invoices/inv_1')
  })
})
