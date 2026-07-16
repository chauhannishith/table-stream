import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orderLines } from '@table-stream/shared-types/hub'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import {
  createModifierGroupEntry,
  createModifierOptionEntry,
} from '../services/menu-catalog.js'
import {
  createTableEntry,
  createZoneEntry,
  setBillingConfig,
} from '../services/floor-setup.js'
import { updateModifierOption } from '../repositories/modifier-groups.js'
import { upsertMenuItemZonePrices } from '../repositories/menu-item-zone-prices.js'

describe('orders routes', () => {
  it('POST /v1/orders requires table_id for DINE_IN', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: { order_type: 'DINE_IN' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toMatch(/table_id/)

    await app.close()
  })

  it('POST /v1/orders creates takeaway and dine-in orders', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Patio' })
    const table = createTableEntry(app.hubDb, locationId, {
      zoneId: zone.id,
      label: 'T1',
    })

    const takeaway = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Alex',
      },
    })
    expect(takeaway.statusCode).toBe(201)
    expect(takeaway.json().order.order_type).toBe('TAKEAWAY')
    expect(takeaway.json().order.zone_id).toBe(zone.id)

    const dineIn = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: { order_type: 'DINE_IN', table_id: table.id },
    })
    expect(dineIn.statusCode).toBe(201)
    expect(dineIn.json().order.table_id).toBe(table.id)
    expect(dineIn.json().order.zone_id).toBe(zone.id)

    await app.close()
  })

  it('adds a line with price/modifier/tag snapshots that stay frozen', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    setBillingConfig(app.hubDb, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const tagRes = await app.inject({
      method: 'POST',
      url: '/v1/menu/tags',
      payload: { code: 'spicy', label: 'Spicy' },
    })
    const tagId = tagRes.json().tag.id

    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Burger',
      basePriceCents: 500,
      tagIds: [tagId],
    })
    upsertMenuItemZonePrices(app.hubDb, item.id, [
      { zoneId: zone.id, priceCents: 650 },
    ])

    const group = createModifierGroupEntry(app.hubDb, locationId, {
      scope: 'ITEM',
      menuItemId: item.id,
      name: 'Extras',
    })
    const option = createModifierOptionEntry(app.hubDb, locationId, group.id, {
      code: 'cheese',
      label: 'Extra cheese',
      priceCents: 100,
    })

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

    const lineRes = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: {
        menu_item_id: item.id,
        quantity: 2,
        modifiers: [{ option_id: option.id }],
      },
    })

    expect(lineRes.statusCode).toBe(201)
    const line = lineRes.json().line
    expect(line.unit_price_cents).toBe(650)
    expect(line.modifiers[0].price_cents).toBe(100)
    expect(line.tags).toEqual([
      { tag_id: tagId, code: 'spicy', label: 'Spicy' },
    ])
    expect(line.line_total_cents).toBe(Math.round(750 * 2 * 1.05))

    updateModifierOption(app.hubDb, option.id, { priceCents: 999 })
    upsertMenuItemZonePrices(app.hubDb, item.id, [
      { zoneId: zone.id, priceCents: 9999 },
    ])

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/orders/${orderId}`,
    })
    const frozen = getRes.json().order.lines[0]
    expect(frozen.unit_price_cents).toBe(650)
    expect(frozen.modifiers[0].price_cents).toBe(100)
    expect(getRes.json().order.subtotal_cents).toBe(1500)

    const second = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: {
        menu_item_id: item.id,
        quantity: 1,
        modifiers: [{ option_id: option.id }],
      },
    })
    expect(second.json().line.unit_price_cents).toBe(9999)
    expect(second.json().line.modifiers[0].price_cents).toBe(999)

    await app.close()
  })

  it('rejects PATCH/DELETE on submitted lines', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
    const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
    const item = createMenuItemEntry(app.hubDb, locationId, {
      categoryId: category.id,
      name: 'Fries',
      basePriceCents: 200,
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

    const lineRes = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: { menu_item_id: item.id },
    })
    const lineId = lineRes.json().line.id

    app.hubDb
      .update(orderLines)
      .set({ isSubmitted: true, status: 'QUEUED' })
      .where(eq(orderLines.id, lineId))
      .run()

    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/orders/${orderId}/lines/${lineId}`,
      payload: { quantity: 3 },
    })
    expect(patch.statusCode).toBe(409)

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/orders/${orderId}/lines/${lineId}`,
    })
    expect(del.statusCode).toBe(409)

    await app.close()
  })

  it('GET /v1/orders?status=OPEN lists open orders', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })

    await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'One',
      },
    })

    const list = await app.inject({
      method: 'GET',
      url: '/v1/orders?status=OPEN',
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().orders).toHaveLength(1)

    await app.close()
  })
})
