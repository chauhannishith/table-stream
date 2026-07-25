import { describe, expect, it, vi } from 'vitest'
import type { HubApiClient } from './api-client'
import {
  DEFAULT_PRINT_STAGES,
  getPrintConfig,
  parsePrintStages,
  updatePrintConfig,
} from './print-config-api'
import {
  createPrinter,
  listPrinters,
  parsePrinterRole,
  updatePrinter,
} from './printers-api'

const samplePrinter = {
  id: 'prn_1',
  location_id: 'loc_test',
  name: 'Kitchen grill',
  role: 'KITCHEN' as const,
  connection: { host: '192.168.1.50', port: 9100 },
  kds_station_ids: ['kds_1'],
  is_active: true,
  updated_at: '2026-07-25T00:00:00.000Z',
}

describe('printer helpers', () => {
  it('parses known printer roles', () => {
    expect(parsePrinterRole('ORDERING')).toBe('ORDERING')
    expect(parsePrinterRole('KITCHEN')).toBe('KITCHEN')
    expect(parsePrinterRole('COLLECTION')).toBe('COLLECTION')
    expect(() => parsePrinterRole('RECEIPT')).toThrow(/ORDERING, KITCHEN/)
  })
})

describe('printers API helpers', () => {
  it('lists, creates, and updates printers', async () => {
    const client = {
      get: vi.fn(async () => ({ printers: [samplePrinter] })),
      post: vi.fn(async () => ({ printer: samplePrinter })),
      patch: vi.fn(async () => ({
        printer: { ...samplePrinter, name: 'Grill', is_active: false },
      })),
    } as unknown as HubApiClient

    await expect(listPrinters(client)).resolves.toEqual([samplePrinter])
    expect(client.get).toHaveBeenCalledWith(
      '/v1/printers?include_inactive=true',
    )

    await expect(
      createPrinter(
        {
          name: ' Kitchen grill ',
          role: 'KITCHEN',
          connection: { host: '192.168.1.50', port: 9100 },
          kds_station_ids: ['kds_1'],
        },
        client,
      ),
    ).resolves.toEqual(samplePrinter)
    expect(client.post).toHaveBeenCalledWith('/v1/printers', {
      body: {
        name: 'Kitchen grill',
        role: 'KITCHEN',
        connection: { host: '192.168.1.50', port: 9100 },
        kds_station_ids: ['kds_1'],
      },
    })

    await expect(
      updatePrinter('prn_1', { name: 'Grill', is_active: false }, client),
    ).resolves.toMatchObject({ name: 'Grill', is_active: false })
  })

  it('rejects invalid roles before calling the hub', async () => {
    const client = {
      post: vi.fn(),
    } as unknown as HubApiClient

    await expect(
      createPrinter(
        {
          name: 'Bad',
          role: 'RECEIPT' as unknown as 'KITCHEN',
        },
        client,
      ),
    ).rejects.toThrow(/ORDERING, KITCHEN/)
    expect(client.post).not.toHaveBeenCalled()
  })
})

describe('print stages helpers', () => {
  it('accepts full stage configs and rejects incomplete ones', () => {
    expect(parsePrintStages(DEFAULT_PRINT_STAGES)).toEqual(
      DEFAULT_PRINT_STAGES,
    )
    expect(() =>
      parsePrintStages({
        ordering: { enabled: true, auto_on_bill: true },
      }),
    ).toThrow(/Invalid print_stages/)
  })
})

describe('print-config API helpers', () => {
  it('gets and puts print stages', async () => {
    const nextStages = {
      ...DEFAULT_PRINT_STAGES,
      ordering: { enabled: false, auto_on_bill: false },
    }
    const client = {
      get: vi.fn(async () => ({
        print_config: {
          location_id: 'loc_test',
          print_stages: DEFAULT_PRINT_STAGES,
          updated_at: null,
        },
      })),
      put: vi.fn(async () => ({
        print_config: {
          location_id: 'loc_test',
          print_stages: nextStages,
          updated_at: '2026-07-25T00:00:00.000Z',
        },
      })),
    } as unknown as HubApiClient

    await expect(getPrintConfig(client)).resolves.toMatchObject({
      print_stages: DEFAULT_PRINT_STAGES,
      updated_at: null,
    })
    expect(client.get).toHaveBeenCalledWith('/v1/location/print-config')

    await expect(updatePrintConfig(nextStages, client)).resolves.toMatchObject({
      print_stages: nextStages,
      updated_at: '2026-07-25T00:00:00.000Z',
    })
    expect(client.put).toHaveBeenCalledWith('/v1/location/print-config', {
      body: { print_stages: nextStages },
    })
  })
})
