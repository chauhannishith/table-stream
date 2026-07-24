import { describe, expect, it, vi } from 'vitest'
import type { HubApiClient } from './api-client'
import {
  createZone,
  listZones,
  taxRulesFromRows,
  taxRulesToRows,
  updateZone,
} from './zones-api'

describe('tax rules helpers', () => {
  it('builds a flat percent map and drops blank keys', () => {
    expect(
      taxRulesFromRows([
        { key: 'cgst', percent: '2.5' },
        { key: '  ', percent: '9' },
        { key: 'sgst', percent: '2.5' },
      ]),
    ).toEqual({ cgst: 2.5, sgst: 2.5 })
  })

  it('rejects negative percents', () => {
    expect(() =>
      taxRulesFromRows([{ key: 'gst', percent: '-1' }]),
    ).toThrow(/tax_rules\.gst/)
  })

  it('round-trips empty and populated maps', () => {
    expect(taxRulesToRows({})).toEqual([{ key: '', percent: '' }])
    expect(taxRulesToRows({ gst: 18 })).toEqual([
      { key: 'gst', percent: '18' },
    ])
  })
})

describe('zones API helpers', () => {
  it('lists zones with include_inactive', async () => {
    const client = {
      get: vi.fn(async () => ({
        zones: [
          {
            id: 'zn_1',
            location_id: 'loc',
            name: 'Patio',
            sort_order: 0,
            tax_rules: {},
            is_active: true,
            updated_at: '2026-07-24T00:00:00.000Z',
          },
        ],
      })),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(listZones(client)).resolves.toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith(
      '/v1/zones?include_inactive=true',
    )
  })

  it('creates and updates zones', async () => {
    const zone = {
      id: 'zn_1',
      location_id: 'loc',
      name: 'Bar',
      sort_order: 0,
      tax_rules: { gst: 18 },
      is_active: true,
      updated_at: '2026-07-24T00:00:00.000Z',
    }
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ zone })),
      patch: vi.fn(async () => ({
        zone: { ...zone, name: 'Main bar', is_active: false },
      })),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(
      createZone({ name: 'Bar', tax_rules: { gst: 18 } }, client),
    ).resolves.toEqual(zone)
    expect(client.post).toHaveBeenCalledWith('/v1/zones', {
      body: { name: 'Bar', tax_rules: { gst: 18 } },
    })

    await expect(
      updateZone(
        'zn_1',
        { name: 'Main bar', is_active: false },
        client,
      ),
    ).resolves.toMatchObject({ name: 'Main bar', is_active: false })
  })
})
