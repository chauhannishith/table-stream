import { PrinterRole } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import {
  createPrinter,
  listPrinters,
  updatePrinter,
  type CreatePrinterInput,
  type ListPrintersOptions,
  type UpdatePrinterInput,
} from '../repositories/printers.js'
import { toPrinterDto } from './printers-dto.js'

/** @throws {AppError} VALIDATION_ERROR when role is not ORDERING, KITCHEN, or COLLECTION */
export function parsePrinterRole(value: string) {
  const parsed = PrinterRole.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid printer role', 400, {
      role: value,
    })
  }
  return parsed.data
}

/** List configured printers for a location. */
export function listPrintersForLocation(
  db: HubDb,
  locationId: string,
  options: ListPrintersOptions = {},
) {
  return listPrinters(db, locationId, options).map(toPrinterDto)
}

/** Create a printer row and return its API DTO. */
export function createPrinterEntry(
  db: HubDb,
  locationId: string,
  input: CreatePrinterInput,
) {
  return toPrinterDto(createPrinter(db, locationId, input))
}

/** Update a printer row; returns null when the printer is missing. */
export function updatePrinterEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdatePrinterInput,
) {
  const row = updatePrinter(db, locationId, id, input)
  return row ? toPrinterDto(row) : null
}
