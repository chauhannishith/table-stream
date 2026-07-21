import {
  PrintStagesConfigSchema,
  type PrintStagesConfig,
} from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import type { LocationPrintConfigRow } from '../repositories/location-print-config.js'
import {
  getLocationPrintConfig,
  upsertLocationPrintConfig,
} from '../repositories/location-print-config.js'

export const DEFAULT_PRINT_STAGES: PrintStagesConfig = {
  ordering: { enabled: true, auto_on_bill: true },
  kitchen: {
    enabled: true,
    auto_on_submit: true,
    split_by_station: true,
    split_by_token: true,
  },
  collection: {
    enabled: true,
    auto_print_dine_in: false,
    auto_print_takeaway: true,
    trigger: 'at_counter',
  },
}

function parseStoredPrintStages(raw: string): PrintStagesConfig {
  try {
    const parsed = PrintStagesConfigSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // fall through to defaults
  }
  return DEFAULT_PRINT_STAGES
}

function toPrintConfigDto(
  row: LocationPrintConfigRow | undefined,
  locationId: string,
) {
  if (!row) {
    return {
      location_id: locationId,
      print_stages: DEFAULT_PRINT_STAGES,
      updated_at: null,
    }
  }

  return {
    location_id: row.locationId,
    print_stages: parseStoredPrintStages(row.printStagesJson),
    updated_at: row.updatedAt,
  }
}

/** Return print stage toggles for a location, using defaults when unset. */
export function getPrintConfig(db: HubDb, locationId: string) {
  return toPrintConfigDto(getLocationPrintConfig(db, locationId), locationId)
}

/** @throws {AppError} VALIDATION_ERROR when print_stages JSON is invalid */
export function parsePrintStages(value: unknown): PrintStagesConfig {
  const parsed = PrintStagesConfigSchema.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid print_stages config', 400)
  }
  return parsed.data
}

/** Upsert print stage toggles for a location. */
export function setPrintConfig(
  db: HubDb,
  locationId: string,
  printStages: PrintStagesConfig,
) {
  const row = upsertLocationPrintConfig(db, locationId, {
    printStagesJson: JSON.stringify(printStages),
  })
  return toPrintConfigDto(row, locationId)
}
