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

export function parsePrinterRole(value: string) {
  const parsed = PrinterRole.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid printer role', 400, {
      role: value,
    })
  }
  return parsed.data
}

export function listPrintersForLocation(
  db: HubDb,
  locationId: string,
  options: ListPrintersOptions = {},
) {
  return listPrinters(db, locationId, options).map(toPrinterDto)
}

export function createPrinterEntry(
  db: HubDb,
  locationId: string,
  input: CreatePrinterInput,
) {
  return toPrinterDto(createPrinter(db, locationId, input))
}

export function updatePrinterEntry(
  db: HubDb,
  locationId: string,
  id: string,
  input: UpdatePrinterInput,
) {
  const row = updatePrinter(db, locationId, id, input)
  return row ? toPrinterDto(row) : null
}
