import type { PrinterRow } from '../repositories/printers.js'

export function toPrinterDto(row: PrinterRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    name: row.name,
    role: row.role,
    connection: JSON.parse(row.connectionJson) as Record<string, unknown>,
    kds_station_ids: row.kdsStationIdsJson
      ? (JSON.parse(row.kdsStationIdsJson) as string[])
      : null,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  }
}
