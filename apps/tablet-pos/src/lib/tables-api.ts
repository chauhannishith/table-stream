import type { TableStatus } from '@table-stream/shared-types/domain'
import { api, type HubApiClient } from './api-client'

export type FloorTable = {
  id: string
  location_id: string
  zone_id: string
  label: string
  capacity: number
  pos_x: number | null
  pos_y: number | null
  status: TableStatus
  version: number
  updated_at: string
}

export type TableWriteInput = {
  zone_id?: string
  label?: string
  capacity?: number
  pos_x?: number | null
  pos_y?: number | null
  status?: TableStatus
}

/** Parse a positive integer capacity from a form string. */
export function parseTableCapacity(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('capacity is required')
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('capacity must be a positive integer')
  }
  const capacity = Number(trimmed)
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error('capacity must be a positive integer')
  }
  return capacity
}

/**
 * Parse an optional map coordinate.
 * Blank means unset (`null`); otherwise a finite number.
 */
export function parseOptionalCoord(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    throw new Error('position must be a number')
  }
  return value
}

/** List tables, optionally filtered by zone. */
export async function listTables(
  zoneId?: string,
  client: HubApiClient = api,
): Promise<FloorTable[]> {
  const query = zoneId
    ? `?zone_id=${encodeURIComponent(zoneId)}`
    : ''
  const result = await client.get<{ tables: FloorTable[] }>(
    `/v1/tables${query}`,
  )
  return result.tables
}

/** Create a table in a zone (hub returns 404 when zone_id is unknown). */
export async function createTable(
  input: {
    zone_id: string
    label: string
    capacity: number
    pos_x?: number | null
    pos_y?: number | null
  },
  client: HubApiClient = api,
): Promise<FloorTable> {
  const body: Record<string, unknown> = {
    zone_id: input.zone_id,
    label: input.label.trim(),
    capacity: input.capacity,
  }
  if (input.pos_x !== undefined) body.pos_x = input.pos_x
  if (input.pos_y !== undefined) body.pos_y = input.pos_y

  const result = await client.post<{ table: FloorTable }>('/v1/tables', {
    body,
  })
  return result.table
}

/** Patch table fields (label, capacity, position, zone, status). */
export async function updateTable(
  id: string,
  input: TableWriteInput,
  client: HubApiClient = api,
): Promise<FloorTable> {
  const body: TableWriteInput = {}
  if (input.zone_id !== undefined) body.zone_id = input.zone_id
  if (input.label !== undefined) body.label = input.label.trim()
  if (input.capacity !== undefined) body.capacity = input.capacity
  if (input.pos_x !== undefined) body.pos_x = input.pos_x
  if (input.pos_y !== undefined) body.pos_y = input.pos_y
  if (input.status !== undefined) body.status = input.status

  const result = await client.patch<{ table: FloorTable }>(
    `/v1/tables/${id}`,
    { body },
  )
  return result.table
}
