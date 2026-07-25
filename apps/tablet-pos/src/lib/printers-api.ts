import type { PrinterRole } from '@table-stream/shared-types/domain'
import { api, type HubApiClient } from './api-client'

export type Printer = {
  id: string
  location_id: string
  name: string
  role: PrinterRole
  connection: Record<string, unknown>
  kds_station_ids: string[] | null
  is_active: boolean
  updated_at: string
}

export type PrinterWriteInput = {
  name?: string
  role?: PrinterRole
  connection?: Record<string, unknown>
  kds_station_ids?: string[] | null
  is_active?: boolean
}

export const PRINTER_ROLES: PrinterRole[] = [
  'ORDERING',
  'KITCHEN',
  'COLLECTION',
]

/** Narrow hub printer role strings; throws on unknown values. */
export function parsePrinterRole(raw: string): PrinterRole {
  if (raw === 'ORDERING' || raw === 'KITCHEN' || raw === 'COLLECTION') {
    return raw
  }
  throw new Error('role must be ORDERING, KITCHEN, or COLLECTION')
}

/** List printers (include inactive for setup reactivation). */
export async function listPrinters(
  client: HubApiClient = api,
): Promise<Printer[]> {
  const result = await client.get<{ printers: Printer[] }>(
    '/v1/printers?include_inactive=true',
  )
  return result.printers
}

/** Create a printer with a hub role (ORDERING / KITCHEN / COLLECTION). */
export async function createPrinter(
  input: {
    name: string
    role: PrinterRole
    connection?: Record<string, unknown>
    kds_station_ids?: string[] | null
  },
  client: HubApiClient = api,
): Promise<Printer> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    role: parsePrinterRole(input.role),
  }
  if (input.connection !== undefined) body.connection = input.connection
  if (input.kds_station_ids !== undefined) {
    body.kds_station_ids = input.kds_station_ids
  }

  const result = await client.post<{ printer: Printer }>('/v1/printers', {
    body,
  })
  return result.printer
}

/** Patch printer fields (rename, role, connection, activate/deactivate). */
export async function updatePrinter(
  id: string,
  input: PrinterWriteInput,
  client: HubApiClient = api,
): Promise<Printer> {
  const body: PrinterWriteInput = {}
  if (input.name !== undefined) body.name = input.name.trim()
  if (input.role !== undefined) body.role = parsePrinterRole(input.role)
  if (input.connection !== undefined) body.connection = input.connection
  if (input.kds_station_ids !== undefined) {
    body.kds_station_ids = input.kds_station_ids
  }
  if (input.is_active !== undefined) body.is_active = input.is_active

  const result = await client.patch<{ printer: Printer }>(
    `/v1/printers/${id}`,
    { body },
  )
  return result.printer
}
