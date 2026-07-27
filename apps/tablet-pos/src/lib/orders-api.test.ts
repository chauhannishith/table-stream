import { describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import {
  createTakeawayOrder,
  normalizeCustomerName,
} from './orders-api'

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
})
