import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { locations } from '@table-stream/shared-types/hub'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import {
  createZoneEntry,
  setBillingConfig,
} from '../services/floor-setup.js'

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
      customer_name: 'Alex',
    },
  })
  const orderId = orderRes.json().order.id

  await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/lines`,
    payload: { menu_item_id: itemId, quantity: 1 },
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

  return orderId
}

describe('invoice routes', () => {
  it('POST /v1/orders/:id/invoice creates immutable invoice with sequence', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Curry',
      basePriceCents: 1000,
    })

    const orderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/invoice`,
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    const invoice = res.json().invoice
    expect(invoice.invoice_number).toBe('INV-00001')
    expect(invoice.order_id).toBe(orderId)
    expect(invoice.total_cents).toBe(1050)
    expect(invoice.line_items).toHaveLength(1)
    expect(invoice.tender_summary.cash).toBe(1050)
    expect(invoice.content_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(invoice.document_path).toMatch(
      new RegExp(`/invoices/${locationId}/\\d{4}/\\d{2}/${invoice.id}\\.pdf$`),
    )
    expect(invoice.business_snapshot.legal_name).toBe('Unknown Business')

    await app.close()
  })

  it('POST /v1/orders/:id/invoice uses cached business profile on header', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    const { upsertBusinessProfileCache } = await import(
      '../repositories/business-profile.js'
    )
    upsertBusinessProfileCache(app.hubDb, {
      orgId: app.hubConfig.org_id,
      legalName: 'Invoice Header Cafe LLP',
      tradeName: 'Header Cafe',
      gstNumber: '29HEADER1234F1Z5',
      addressLinesJson: JSON.stringify({ city: 'Delhi' }),
      phone: '+91-8888888888',
      email: 'billing@header.test',
      logoPath: null,
      fetchedAt: '2026-07-01 12:00:00',
      expiresAt: '2099-01-01 00:00:00',
    })

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Paneer',
      basePriceCents: 800,
    })

    const orderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/invoice`,
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().invoice.business_snapshot).toEqual({
      legal_name: 'Invoice Header Cafe LLP',
      trade_name: 'Header Cafe',
      gst_number: '29HEADER1234F1Z5',
      address_lines: { city: 'Delhi' },
      phone: '+91-8888888888',
      email: 'billing@header.test',
      logo_path: null,
    })

    await app.close()
  })

  it('increments invoice_number per location', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Dal',
      basePriceCents: 500,
    })

    const firstOrderId = await createPaidTakeawayOrder(app, locationId, item.id)
    const secondOrderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const first = await app.inject({
      method: 'POST',
      url: `/v1/orders/${firstOrderId}/invoice`,
      payload: {},
    })
    const second = await app.inject({
      method: 'POST',
      url: `/v1/orders/${secondOrderId}/invoice`,
      payload: {},
    })

    expect(first.json().invoice.invoice_number).toBe('INV-00001')
    expect(second.json().invoice.invoice_number).toBe('INV-00002')

    await app.close()
  })

  it('GET /v1/invoices/:id returns unchanged snapshot for reprint', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Roti',
      basePriceCents: 100,
    })

    const orderId = await createPaidTakeawayOrder(app, locationId, item.id)

    const issueRes = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/invoice`,
      payload: {},
    })
    const invoiceId = issueRes.json().invoice.id

    const firstGet = await app.inject({
      method: 'GET',
      url: `/v1/invoices/${invoiceId}`,
    })
    const secondGet = await app.inject({
      method: 'GET',
      url: `/v1/invoices/${invoiceId}`,
    })

    expect(firstGet.statusCode).toBe(200)
    expect(secondGet.statusCode).toBe(200)
    expect(secondGet.json().invoice).toEqual(firstGet.json().invoice)

    await app.close()
  })

  it('GET /v1/invoices/:id allowed when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Naan',
      basePriceCents: 150,
    })

    const orderId = await createPaidTakeawayOrder(app, locationId, item.id)
    const issueRes = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/invoice`,
      payload: {},
    })
    const invoiceId = issueRes.json().invoice.id

    app.hubDb
      .update(locations)
      .set({ hubStatus: 'SUSPENDED' })
      .where(eq(locations.id, locationId))
      .run()

    const res = await app.inject({
      method: 'GET',
      url: `/v1/invoices/${invoiceId}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().invoice.id).toBe(invoiceId)

    await app.close()
  })

  it('POST /v1/orders/:id/invoice blocked when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Rice',
      basePriceCents: 200,
    })

    const orderId = await createPaidTakeawayOrder(app, locationId, item.id)

    app.hubDb
      .update(locations)
      .set({ hubStatus: 'SUSPENDED' })
      .where(eq(locations.id, locationId))
      .run()

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/invoice`,
      payload: {},
    })

    expect(res.statusCode).toBe(403)

    await app.close()
  })

  it('POST /v1/orders/:id/invoice requires paid order', async () => {
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
      name: 'Soup',
      basePriceCents: 300,
    })

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Pat',
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

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/invoice`,
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toMatch(/paid/)

    await app.close()
  })
})
