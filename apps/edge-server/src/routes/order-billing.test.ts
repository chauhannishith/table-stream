import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { locations } from '@table-stream/shared-types/hub'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import {
  createZoneEntry,
  setBillingConfig,
} from '../services/floor-setup.js'

async function createTakeawayOrderWithLine(
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

  return orderId
}

describe('order billing routes', () => {
  it('POST /v1/orders/:id/bill/preview matches shared-utils golden totals', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Steak',
      basePriceCents: 10000,
    })

    const orderId = await createTakeawayOrderWithLine(app, locationId, item.id)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/bill/preview`,
      payload: {
        discount_type: 'PERCENT',
        discount_value: 10,
        tip_cents: 500,
      },
    })

    expect(res.statusCode).toBe(200)
    const preview = res.json().preview
    expect(preview.subtotal_cents).toBe(10000)
    expect(preview.discount_cents).toBe(1000)
    expect(preview.discounted_subtotal_cents).toBe(9000)
    expect(preview.tax_cents).toBe(450)
    expect(preview.tip_cents).toBe(500)
    expect(preview.total_cents).toBe(9950)

    await app.close()
  })

  it('includes modifier extras in preview subtotal', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Bar' })
    const category = createCategory(app.hubDb, locationId, { name: 'Drinks' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Latte',
      basePriceCents: 50000,
    })

    const groupRes = await app.inject({
      method: 'POST',
      url: '/v1/menu/modifier-groups',
      payload: {
        scope: 'ITEM',
        menu_item_id: item.id,
        name: 'Extras',
      },
    })
    const groupId = groupRes.json().group.id

    const optionRes = await app.inject({
      method: 'POST',
      url: `/v1/menu/modifier-groups/${groupId}/options`,
      payload: { code: 'oat', label: 'Oat milk', price_cents: 150 },
    })
    const optionId = optionRes.json().option.id

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Sam',
      },
    })
    const orderId = orderRes.json().order.id

    await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: {
        menu_item_id: item.id,
        quantity: 1,
        modifiers: [{ option_id: optionId }],
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/bill/preview`,
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    const preview = res.json().preview
    expect(preview.subtotal_cents).toBe(50150)
    expect(preview.tax_cents).toBe(Math.round(50150 * 0.05))

    await app.close()
  })

  it('returns 404 when order is missing', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders/missing-order/bill/preview',
      payload: {},
    })

    expect(res.statusCode).toBe(404)

    await app.close()
  })

  it('POST /v1/orders/:id/bill locks totals on the order', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Pasta',
      basePriceCents: 10000,
    })

    const orderId = await createTakeawayOrderWithLine(app, locationId, item.id)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/bill`,
      payload: {
        discount_type: 'PERCENT',
        discount_value: 10,
        tip_cents: 500,
      },
    })

    expect(res.statusCode).toBe(200)
    const order = res.json().order
    expect(order.status).toBe('CHECK_PRINTED')
    expect(order.discount_type).toBe('PERCENT')
    expect(order.discount_value).toBe(10)
    expect(order.discount_cents).toBe(1000)
    expect(order.tip_cents).toBe(500)
    expect(order.subtotal_cents).toBe(10000)
    expect(order.tax_cents).toBe(450)
    expect(order.total_cents).toBe(9950)

    await app.close()
  })

  it('POST /v1/orders/:id/bill returns 403 when hub is SUSPENDED', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id

    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Soup',
      basePriceCents: 500,
    })

    const orderId = await createTakeawayOrderWithLine(app, locationId, item.id)

    app.hubDb
      .update(locations)
      .set({ hubStatus: 'SUSPENDED' })
      .where(eq(locations.id, locationId))
      .run()

    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/bill`,
      payload: {},
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
    expect(res.json().error.details.hub_status).toBe('SUSPENDED')

    await app.close()
  })
})
