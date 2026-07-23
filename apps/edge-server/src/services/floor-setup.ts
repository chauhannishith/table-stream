import type { PriceTaxMode, StaffRole, TableStatus } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { hashPin } from '../lib/auth.js'
import {
  createKdsStation,
  listKdsStations,
  updateKdsStation,
  type CreateKdsStationInput,
  type ListKdsStationsOptions,
  type UpdateKdsStationInput,
} from '../repositories/kds-stations.js'
import {
  getLocationBillingConfig,
  upsertLocationBillingConfig,
  type UpsertLocationBillingConfigInput,
} from '../repositories/location-billing-config.js'
import {
  createStaff,
  listStaff,
  updateStaff,
  type CreateStaffInput,
  type ListStaffOptions,
  type UpdateStaffInput,
} from '../repositories/staff.js'
import {
  createTable,
  listTables,
  updateTable,
  type CreateTableInput,
  type ListTablesOptions,
  type UpdateTableInput,
} from '../repositories/tables.js'
import {
  createZone,
  listZones,
  updateZone,
  type CreateZoneInput,
  type ListZonesOptions,
  type UpdateZoneInput,
} from '../repositories/zones.js'
import {
  toBillingConfigDto,
  toKdsStationDto,
  toStaffDto,
  toTableDto,
  toZoneDto,
} from './floor-setup-dto.js'
import { parseTaxRulesMap } from './billing.js'

export function listZonesForLocation(
  db: HubDb,
  locationId: string,
  options: ListZonesOptions = {},
) {
  return listZones(db, locationId, options).map(toZoneDto)
}

export function createZoneEntry(
  db: HubDb,
  locationId: string,
  input: CreateZoneInput,
) {
  return toZoneDto(createZone(db, locationId, input))
}

export function updateZoneEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateZoneInput,
) {
  const row = updateZone(db, locationId, id, input)
  return row ? toZoneDto(row) : null
}

export function listTablesForLocation(
  db: HubDb,
  locationId: string,
  options: ListTablesOptions = {},
) {
  return listTables(db, locationId, options).map(toTableDto)
}

export function createTableEntry(
  db: HubDb,
  locationId: string,
  input: CreateTableInput,
) {
  try {
    return toTableDto(createTable(db, locationId, input))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Zone not found:')) {
      throw new AppError('NOT_FOUND', 'Zone not found', 404, {
        zone_id: input.zoneId,
      })
    }
    throw error
  }
}

export function updateTableEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateTableInput,
) {
  try {
    const row = updateTable(db, locationId, id, input)
    return row ? toTableDto(row) : null
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Zone not found:') &&
      input.zoneId
    ) {
      throw new AppError('NOT_FOUND', 'Zone not found', 404, {
        zone_id: input.zoneId,
      })
    }
    throw error
  }
}

export function listStaffForLocation(
  db: HubDb,
  locationId: string,
  options: ListStaffOptions = {},
) {
  return listStaff(db, locationId, options).map(toStaffDto)
}

export function createStaffEntry(
  db: HubDb,
  locationId: string,
  input: Omit<CreateStaffInput, 'pinHash'> & { pin: string },
) {
  return toStaffDto(
    createStaff(db, locationId, {
      ...input,
      pinHash: hashPin(input.pin),
    }),
  )
}

export function updateStaffEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateStaffInput & { pin?: string },
) {
  const { pin, ...rest } = input
  const patch: UpdateStaffInput = { ...rest }
  if (pin !== undefined) {
    patch.pinHash = hashPin(pin)
  }

  const row = updateStaff(db, locationId, id, patch)
  return row ? toStaffDto(row) : null
}

export function getBillingConfig(db: HubDb, locationId: string) {
  return toBillingConfigDto(getLocationBillingConfig(db, locationId), locationId)
}

export function setBillingConfig(
  db: HubDb,
  locationId: string,
  input: {
    taxRules?: Record<string, unknown>
    priceTaxMode?: PriceTaxMode
    serviceChargeRules?: Record<string, unknown>
    tipQuickActions?: unknown[]
  },
) {
  const patch: UpsertLocationBillingConfigInput = {}
  if (input.taxRules !== undefined) {
    patch.taxRulesJson = JSON.stringify(parseTaxRulesMap(input.taxRules))
  }
  if (input.priceTaxMode !== undefined) {
    patch.priceTaxMode = input.priceTaxMode
  }
  if (input.serviceChargeRules !== undefined) {
    patch.serviceChargeRulesJson = JSON.stringify(input.serviceChargeRules)
  }
  if (input.tipQuickActions !== undefined) {
    patch.tipQuickActionsJson = JSON.stringify(input.tipQuickActions)
  }

  return toBillingConfigDto(
    upsertLocationBillingConfig(db, locationId, patch),
    locationId,
  )
}

export function listKdsStationsForLocation(
  db: HubDb,
  locationId: string,
  options: ListKdsStationsOptions = {},
) {
  return listKdsStations(db, locationId, options).map(toKdsStationDto)
}

export function createKdsStationEntry(
  db: HubDb,
  locationId: string,
  input: CreateKdsStationInput,
) {
  return toKdsStationDto(createKdsStation(db, locationId, input))
}

export function updateKdsStationEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdateKdsStationInput,
) {
  const row = updateKdsStation(db, locationId, id, input)
  return row ? toKdsStationDto(row) : null
}

export function parseStaffRole(role: string): StaffRole {
  if (role === 'ADMIN' || role === 'COUNTER' || role === 'WAITER') {
    return role
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid staff role', 400, { role })
}

export function parseTableStatus(status: string): TableStatus {
  if (
    status === 'AVAILABLE' ||
    status === 'OCCUPIED' ||
    status === 'RESERVED' ||
    status === 'DIRTY'
  ) {
    return status
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid table status', 400, { status })
}

export function parsePriceTaxMode(mode: string): PriceTaxMode {
  if (mode === 'INCLUSIVE' || mode === 'EXCLUSIVE') {
    return mode
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid price_tax_mode', 400, {
    price_tax_mode: mode,
  })
}
