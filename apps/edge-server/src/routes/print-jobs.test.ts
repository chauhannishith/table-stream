import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createCategory, createMenuItemEntry } from '../services/menu-catalog.js'
import {
  createKdsStationEntry,
  createZoneEntry,
} from '../services/floor-setup.js'
import { createPrinterEntry } from '../services/printers.js'

async function seedSubmittedOrder(app: Awaited<ReturnType<typeof createTestApp>>) {
  const locationId = app.hubConfig.location_id
  const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })
  const station = createKdsStationEntry(app.hubDb, locationId, { name: 'Grill' })
  const category = createCategory(app.hubDb, locationId, { name: 'Mains' })
  const item = createMenuItemEntry(app.hubDb, locationId, {
    categoryId: category.id,
    name: 'Burger',
    basePriceCents: 500,
    kdsStationId: station.id,
  })

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
    payload: { menu_item_id: item.id },
  })

  const submit = await app.inject({
    method: 'POST',
    url: `/v1/orders/${orderId}/submit`,
  })

  return {
    orderId,
    submitBatch: submit.json().submission.submit_batch as number,
    lineId: submit.json().submission.lines[0].id as string,
  }
}

describe('print jobs routes', () => {
  it('POST /v1/print-jobs enqueues a kitchen job with snapshot payload', async () => {
    const app = await createTestApp()
    const { orderId, submitBatch } = await seedSubmittedOrder(app)

    createPrinterEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Kitchen main',
      role: 'KITCHEN',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/print-jobs',
      payload: {
        order_id: orderId,
        stage: 'KITCHEN',
        submit_batch: submitBatch,
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().print_job).toEqual(
      expect.objectContaining({
        order_id: orderId,
        stage: 'KITCHEN',
        submit_batch: submitBatch,
        status: 'PENDING',
        attempt_count: 0,
        printer_id: expect.any(String),
      }),
    )
    expect(res.json().print_job.payload).toEqual(
      expect.objectContaining({
        stage: 'KITCHEN',
        order_id: orderId,
        token_number: expect.stringMatching(/^T-\d{3}$/),
        lines: [
          expect.objectContaining({
            name: 'Burger',
            is_submitted: true,
            submit_batch: submitBatch,
          }),
        ],
      }),
    )

    await app.close()
  })

  it('POST /v1/print-jobs rejects kitchen print without submitted lines', async () => {
    const app = await createTestApp()
    const locationId = app.hubConfig.location_id
    const zone = createZoneEntry(app.hubDb, locationId, { name: 'Counter' })

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        order_type: 'TAKEAWAY',
        zone_id: zone.id,
        customer_name: 'Lee',
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/print-jobs',
      payload: {
        order_id: orderRes.json().order.id,
        stage: 'KITCHEN',
      },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('POST /v1/print-jobs rejects printer role mismatch', async () => {
    const app = await createTestApp()
    const { orderId, submitBatch } = await seedSubmittedOrder(app)

    const printer = createPrinterEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Counter receipt',
      role: 'ORDERING',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/print-jobs',
      payload: {
        order_id: orderId,
        stage: 'KITCHEN',
        submit_batch: submitBatch,
        printer_id: printer.id,
      },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('PATCH /v1/print-jobs/:id/status advances the job status machine', async () => {
    const app = await createTestApp()
    const { orderId, submitBatch } = await seedSubmittedOrder(app)

    createPrinterEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Kitchen main',
      role: 'KITCHEN',
    })

    const created = await app.inject({
      method: 'POST',
      url: '/v1/print-jobs',
      payload: {
        order_id: orderId,
        stage: 'KITCHEN',
        submit_batch: submitBatch,
      },
    })
    const jobId = created.json().print_job.id

    const printing = await app.inject({
      method: 'PATCH',
      url: `/v1/print-jobs/${jobId}/status`,
      payload: { status: 'PRINTING' },
    })
    expect(printing.statusCode).toBe(200)
    expect(printing.json().print_job.status).toBe('PRINTING')

    const done = await app.inject({
      method: 'PATCH',
      url: `/v1/print-jobs/${jobId}/status`,
      payload: { status: 'DONE' },
    })
    expect(done.statusCode).toBe(200)
    expect(done.json().print_job.status).toBe('DONE')

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/v1/print-jobs/${jobId}/status`,
      payload: { status: 'PENDING' },
    })
    expect(invalid.statusCode).toBe(400)

    await app.close()
  })

  it('PATCH /v1/print-jobs/:id/status increments attempts on failure', async () => {
    const app = await createTestApp()
    const { orderId, submitBatch } = await seedSubmittedOrder(app)

    createPrinterEntry(app.hubDb, app.hubConfig.location_id, {
      name: 'Kitchen main',
      role: 'KITCHEN',
    })

    const created = await app.inject({
      method: 'POST',
      url: '/v1/print-jobs',
      payload: {
        order_id: orderId,
        stage: 'KITCHEN',
        submit_batch: submitBatch,
      },
    })
    const jobId = created.json().print_job.id

    await app.inject({
      method: 'PATCH',
      url: `/v1/print-jobs/${jobId}/status`,
      payload: { status: 'PRINTING' },
    })

    const failed = await app.inject({
      method: 'PATCH',
      url: `/v1/print-jobs/${jobId}/status`,
      payload: { status: 'FAILED' },
    })

    expect(failed.statusCode).toBe(200)
    expect(failed.json().print_job.status).toBe('FAILED')
    expect(failed.json().print_job.attempt_count).toBe(1)

    await app.close()
  })
})
