import { describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import {
  createTable,
  listTables,
  parseOptionalCoord,
  parseTableCapacity,
  updateTable,
} from './tables-api'

const sampleTable = {
  id: 'tbl_1',
  location_id: 'loc_test',
  zone_id: 'zn_1',
  label: 'T1',
  capacity: 4,
  pos_x: 10,
  pos_y: 20,
  status: 'AVAILABLE' as const,
  version: 1,
  updated_at: '2026-07-25T00:00:00.000Z',
}

describe('table form helpers', () => {
  it('parses positive capacity', () => {
    expect(parseTableCapacity('4')).toBe(4)
    expect(parseTableCapacity(' 12 ')).toBe(12)
    expect(() => parseTableCapacity('')).toThrow(/required/)
    expect(() => parseTableCapacity('0')).toThrow(/positive integer/)
    expect(() => parseTableCapacity('1.5')).toThrow(/positive integer/)
  })

  it('parses optional coordinates', () => {
    expect(parseOptionalCoord('')).toBeNull()
    expect(parseOptionalCoord('  ')).toBeNull()
    expect(parseOptionalCoord('10')).toBe(10)
    expect(parseOptionalCoord('-2.5')).toBe(-2.5)
    expect(() => parseOptionalCoord('abc')).toThrow(/number/)
  })
})

describe('tables API helpers', () => {
  it('lists tables with and without zone filter', async () => {
    const client = {
      get: vi.fn(async () => ({ tables: [sampleTable] })),
    } as unknown as HubApiClient

    await expect(listTables(undefined, client)).resolves.toEqual([
      sampleTable,
    ])
    expect(client.get).toHaveBeenCalledWith('/v1/tables')

    await expect(listTables('zn_1', client)).resolves.toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith('/v1/tables?zone_id=zn_1')
  })

  it('creates and updates tables', async () => {
    const client = {
      post: vi.fn(async () => ({ table: sampleTable })),
      patch: vi.fn(async () => ({
        table: { ...sampleTable, label: 'T1a', capacity: 6, version: 2 },
      })),
    } as unknown as HubApiClient

    await expect(
      createTable(
        {
          zone_id: 'zn_1',
          label: ' T1 ',
          capacity: 4,
          pos_x: 10,
          pos_y: 20,
        },
        client,
      ),
    ).resolves.toEqual(sampleTable)
    expect(client.post).toHaveBeenCalledWith('/v1/tables', {
      body: {
        zone_id: 'zn_1',
        label: 'T1',
        capacity: 4,
        pos_x: 10,
        pos_y: 20,
      },
    })

    await expect(
      updateTable('tbl_1', { label: 'T1a', capacity: 6 }, client),
    ).resolves.toMatchObject({ label: 'T1a', capacity: 6, version: 2 })
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
      createTable(
        { zone_id: 'zone_missing', label: 'T1', capacity: 2 },
        client,
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Zone not found',
      status: 404,
    })
  })
})
