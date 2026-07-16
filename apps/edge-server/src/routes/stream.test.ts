import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import { createZoneEntry } from '../services/floor-setup.js'
import { hubEvents } from '../lib/hub-events.js'

describe('stream events', () => {
  it('publishes order.submitted on the hub event bus after submit', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
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
        customer_name: 'Lee',
      },
    })
    const orderId = orderRes.json().order.id
    await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/lines`,
      payload: { menu_item_id: item.id },
    })

    const events: Array<{ event_type: string; payload: Record<string, unknown> }> =
      []
    const unsubscribe = hubEvents.subscribe((event) => {
      events.push(event)
    })

    const submit = await app.inject({
      method: 'POST',
      url: `/v1/orders/${orderId}/submit`,
    })
    expect(submit.statusCode).toBe(200)

    unsubscribe()
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'order.submitted',
          location_id: locationId,
          payload: expect.objectContaining({ order_id: orderId }),
        }),
      ]),
    )

    await app.close()
  })
})
