import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { locations } from '@table-stream/shared-types/hub'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import {
  createZoneEntry,
  setBillingConfig,
} from '../services/floor-setup.js'
import { buildDailyTotals } from '../services/hub-export.js'

async function createPaidTakeawayOrder(
  app: Awaited<ReturnType<typeof createTestApp>>,
  locationId: string,
  itemId: string,
) {
  const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })

  const orderRes = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    payload: {
      order_type: 'TAKEAWAY',
      zone_id: zone.id,
      customer_name: 'Export Guest',
    },
  })
  const orderId = orderRes.json().order.id

  await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/lines`,
    payload: { menu_item_id: itemId, quantity: 2 },
  })

  await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/bill`,
    payload: {},
  })

  await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/payments`,
    payload: { tender_type: 'CASH' },
  })

  await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/invoice`,
    payload: {},
  })

  return orderId
}

describe('buildDailyTotals', () => {
  it('aggregates PAID orders by calendar day and skips incomplete/VOID', () => {
    const totals = buildDailyTotals([
      {
        id: 'o1',
        order_type: 'TAKEAWAY',
        status: 'PAID',
        zone_id: 'z1',
        table_id: null,
        customer_name: null,
        server_id: null,
        token_number: '1',
        opened_at: '2026-07-01 10:00:00',
        closed_at: '2026-07-01 11:00:00',
        subtotal_cents: 1000,
        tax_cents: 50,
        discount_cents: 0,
        tip_cents: 100,
        total_cents: 1150,
      },
      {
        id: 'o2',
        order_type: 'TAKEAWAY',
        status: 'VOID',
        zone_id: 'z1',
        table_id: null,
        customer_name: null,
        server_id: null,
        token_number: null,
        opened_at: '2026-07-01 12:00:00',
        closed_at: '2026-07-01 12:30:00',
        subtotal_cents: 500,
        tax_cents: 25,
        discount_cents: 0,
        tip_cents: 0,
        total_cents: 525,
      },
      {
        id: 'o-draft',
        order_type: 'TAKEAWAY',
        status: 'DRAFT',
        zone_id: 'z1',
        table_id: null,
        customer_name: null,
        server_id: null,
        token_number: null,
        opened_at: '2026-07-01 13:00:00',
        closed_at: null,
        subtotal_cents: 300,
        tax_cents: 0,
        discount_cents: 0,
        tip_cents: 0,
        total_cents: 300,
      },
      {
        id: 'o3',
        order_type: 'DINE_IN',
        status: 'PAID',
        zone_id: 'z1',
        table_id: 't1',
        customer_name: null,
        server_id: null,
        token_number: '2',
        opened_at: '2026-07-02 09:00:00',
        closed_at: '2026-07-02 09:30:00',
        subtotal_cents: 2000,
        tax_cents: 100,
        discount_cents: 200,
        tip_cents: 0,
        total_cents: 1900,
      },
    ])

    expect(totals).toEqual([
      {
        date: '2026-07-01',
        order_count: 1,
        subtotal_cents: 1000,
        tax_cents: 50,
        discount_cents: 0,
        tip_cents: 100,
        total_cents: 1150,
      },
      {
        date: '2026-07-02',
        order_count: 1,
        subtotal_cents: 2000,
        tax_cents: 100,
        discount_cents: 200,
        tip_cents: 0,
        total_cents: 1900,
      },
    ])
  })
})

describe('GET /v1/export/full', () => {
  it('returns a JSON archive with core sheets', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Export Curry',
      basePriceCents: 500,
    })

    const orderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const res = await app.inject({ method: 'GET', url: '/v1/export/full' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.format).toBe('json_archive_v1')
    expect(body.location_id).toBe(locationId)
    expect(body.hub_status).toBe('ACTIVE')
    expect(body.orders).toHaveLength(1)
    expect(body.orders[0].id).toBe(orderId)
    expect(body.order_lines).toHaveLength(1)
    expect(body.payments).toHaveLength(1)
    expect(body.invoices).toHaveLength(1)
    expect(body.invoices[0].invoice_number).toBe('INV-00001')
    expect(body.invoices[0].tax_breakdown).toEqual({ cgst: 25, sgst: 25 })
    expect(body.invoices[0].applied_tax_rules).toEqual({ cgst: 2.5, sgst: 2.5 })
    expect(body.invoices[0].combined_rate_percent).toBe(5)
    expect(body.tax_by_rate).toEqual([
      { combined_rate_percent: 5, tax_cents: 50, invoice_count: 1 },
    ])
    expect(body.menu_items.some((row: { name: string }) => row.name === 'Export Curry')).toBe(
      true,
    )
    expect(body.staff.every((row: Record<string, unknown>) => !('pin_hash' in row))).toBe(
      true,
    )
    expect(body.daily_totals).toHaveLength(1)
    expect(body.daily_totals[0].order_count).toBe(1)

    await app.close()
  })

  it('aggregates tax_by_rate across 5% and 18% zone invoices', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const outdoor = createZoneEntry(app.hubDb, locationId, {
      name: 'Outdoor',
      taxRulesJson: JSON.stringify({ gst: 5 }),
    })
    const bar = createZoneEntry(app.hubDb, locationId, {
      name: 'Bar',
      taxRulesJson: JSON.stringify({ gst: 18 }),
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Tax Item',
      basePriceCents: 10000,
    })

    async function payAndInvoice(zoneId: string) {
      const orderRes = await app.inject({
        method: 'POST',
        url: '/v1/orders',
        payload: {
          order_type: 'TAKEAWAY',
          zone_id: zoneId,
          customer_name: 'Rate Guest',
        },
      })
      const orderId = orderRes.json().order.id
      await app.inject({
        method: 'POST',
        url: `/v1/orders/${orderId}/lines`,
        payload: { menu_item_id: item.id, quantity: 1 },
      })
      await app.inject({
        method: 'POST',
        url: `/v1/orders/${orderId}/bill`,
        payload: {},
      })
      await app.inject({
        method: 'POST',
        url: `/v1/orders/${orderId}/payments`,
        payload: { tender_type: 'CASH' },
      })
      await app.inject({
        method: 'POST',
        url: `/v1/orders/${orderId}/invoice`,
        payload: {},
      })
      return orderId
    }

    await payAndInvoice(outdoor.id)
    await payAndInvoice(bar.id)

    const res = await app.inject({ method: 'GET', url: '/v1/export/full' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.invoices).toHaveLength(2)
    expect(body.tax_by_rate).toEqual([
      { combined_rate_percent: 5, tax_cents: 500, invoice_count: 1 },
      { combined_rate_percent: 18, tax_cents: 1800, invoice_count: 1 },
    ])

    await app.close()
  })

  it('excludes DRAFT/OPEN orders from the archive', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Open Item',
      basePriceCents: 400,
    })

    const draftRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Still Open',
      },
    })
    expect(draftRes.statusCode).toBe(201)
    const draftOrderId = draftRes.json().order.id

    await app.inject({
      method: 'POST',
      url: `/v1/orders/${draftOrderId}/lines`,
      payload: { menu_item_id: item.id, quantity: 1 },
    })

    const paidOrderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const res = await app.inject({ method: 'GET', url: '/v1/export/full' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual([paidOrderId])
    expect(body.order_lines.every((l: { order_id: string }) => l.order_id === paidOrderId)).toBe(
      true,
    )
    expect(body.invoices.every((i: { order_id: string }) => i.order_id === paidOrderId)).toBe(
      true,
    )
    expect(body.daily_totals[0].order_count).toBe(1)

    await app.close()
  })

  it('excludes invoices not tied to PAID orders', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Orphan Invoice Item',
      basePriceCents: 250,
    })

    const draftRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Draft',
      },
    })
    const draftOrderId = draftRes.json().order.id

    const { createPayment } = await import('../repositories/payments.js')
    const payment = createPayment(app.hubDb, {
      orderId: draftOrderId,
      amountCents: 250,
      tenderType: 'CASH',
    })

    const { createInvoice } = await import('../repositories/invoices.js')
    createInvoice(app.hubDb, {
      id: 'inv_orphan',
      locationId,
      orderId: draftOrderId,
      paymentId: payment.id,
      invoiceNumber: 'INV-ORPHAN',
      issuedAt: '2026-07-01 12:00:00',
      subtotalCents: 250,
      taxCents: 0,
      discountCents: 0,
      tipCents: 0,
      totalCents: 250,
      tenderSummaryJson: '{}',
      lineItemsJson: '[]',
      cashierName: 'Counter',
      tokenNumber: '',
      businessSnapshotJson: '{}',
      taxBreakdownJson: '{}',
      metadataJson: '{}',
      documentPath: '/tmp/orphan.pdf',
      contentHash: 'abc',
    })

    const paidOrderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const res = await app.inject({ method: 'GET', url: '/v1/export/full' })
    expect(res.statusCode).toBe(200)
    const invoices = res.json().invoices as { order_id: string; invoice_number: string }[]
    expect(invoices.map((i) => i.order_id)).toEqual([paidOrderId])
    expect(invoices.some((i) => i.invoice_number === 'INV-ORPHAN')).toBe(false)

    await app.close()
  })

  it('allows export when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Archive Soup',
      basePriceCents: 300,
    })

    await createPaidTakeawayOrder(app, locationId, item.id)

    app.hubDb
      .update(locations)
      .set({ hubStatus: 'SUSPENDED' })
      .where(eq(locations.id, locationId))
      .run()

    const res = await app.inject({ method: 'GET', url: '/v1/export/full' })

    expect(res.statusCode).toBe(200)
    expect(res.json().hub_status).toBe('SUSPENDED')
    expect(res.json().orders).toHaveLength(1)
    expect(res.json().invoices).toHaveLength(1)

    await app.close()
  })
})
