import type { KdsStationRow } from '../repositories/kds-stations.js'
import type { LocationBillingConfigRow } from '../repositories/location-billing-config.js'
import type { StaffRow } from '../repositories/staff.js'
import type { TableRow } from '../repositories/tables.js'
import type { ZoneRow } from '../repositories/zones.js'

export function toZoneDto(row: ZoneRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    name: row.name,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}

export function toTableDto(row: TableRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    zone_id: row.zoneId,
    label: row.label,
    capacity: row.capacity,
    pos_x: row.posX,
    pos_y: row.posY,
    status: row.status,
    version: row.version,
    updated_at: row.updatedAt,
  }
}

export function toStaffDto(row: StaffRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    name: row.name,
    role: row.role,
    assigned_zone_ids: JSON.parse(row.assignedZoneIdsJson) as string[],
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export function toKdsStationDto(row: KdsStationRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    name: row.name,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}

export function toBillingConfigDto(
  row: LocationBillingConfigRow | undefined,
  locationId: string,
) {
  if (!row) {
    return {
      location_id: locationId,
      tax_rules: {},
      price_tax_mode: 'EXCLUSIVE' as const,
      service_charge_rules: {},
      tip_quick_actions: [],
      updated_at: null,
    }
  }

  return {
    location_id: row.locationId,
    tax_rules: JSON.parse(row.taxRulesJson) as Record<string, unknown>,
    price_tax_mode: row.priceTaxMode,
    service_charge_rules: JSON.parse(row.serviceChargeRulesJson) as Record<
      string,
      unknown
    >,
    tip_quick_actions: JSON.parse(row.tipQuickActionsJson) as unknown[],
    updated_at: row.updatedAt,
  }
}
