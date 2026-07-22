import {
  PrintJobStatus,
  PrintStage,
  type PrintStage as PrintStageType,
} from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { getIssuedInvoiceByOrderId } from '../repositories/invoices.js'
import { listOrderLines } from '../repositories/order-lines.js'
import { getOrderById } from '../repositories/orders.js'
import {
  createPrintJob,
  getPrintJobById,
  updatePrintJobStatus as persistPrintJobStatus,
} from '../repositories/print-jobs.js'
import { getPrinterById, listPrinters } from '../repositories/printers.js'
import { getPrintConfig } from './print-config.js'
import { toOrderLineDto } from './orders-dto.js'
import { toPrintJobDto } from './print-jobs-dto.js'

const STAGE_CONFIG_KEY: Record<PrintStageType, 'ordering' | 'kitchen' | 'collection'> =
  {
    ORDERING: 'ordering',
    KITCHEN: 'kitchen',
    COLLECTION: 'collection',
  }

const STATUS_TRANSITIONS: Record<string, PrintJobStatus[]> = {
  PENDING: ['PRINTING'],
  PRINTING: ['DONE', 'FAILED'],
}

export function parsePrintStage(value: string): PrintStageType {
  const parsed = PrintStage.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid print stage', 400, {
      stage: value,
    })
  }
  return parsed.data
}

export function parsePrintJobStatus(value: string): PrintJobStatus {
  const parsed = PrintJobStatus.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid print job status', 400, {
      status: value,
    })
  }
  return parsed.data
}

function assertStageEnabled(db: HubDb, locationId: string, stage: PrintStageType) {
  const config = getPrintConfig(db, locationId)
  const stageConfig = config.print_stages[STAGE_CONFIG_KEY[stage]]
  if (!stageConfig.enabled) {
    throw new AppError(
      'CONFLICT',
      `Print stage ${stage} is disabled for this location`,
      409,
      { stage },
    )
  }
}

function resolvePrinter(
  db: HubDb,
  locationId: string,
  stage: PrintStageType,
  printerId?: string | null,
) {
  if (printerId) {
    const printer = getPrinterById(db, locationId, printerId)
    if (!printer || !printer.isActive) {
      throw new AppError('NOT_FOUND', 'Printer not found', 404, {
        printer_id: printerId,
      })
    }
    if (printer.role !== stage) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Printer role does not match print stage',
        400,
        { printer_id: printerId, stage, role: printer.role },
      )
    }
    return printer.id
  }

  const match = listPrinters(db, locationId).find((row) => row.role === stage)
  return match?.id ?? null
}

function buildPrintPayload(
  db: HubDb,
  locationId: string,
  orderId: string,
  stage: PrintStageType,
  submitBatch?: number | null,
) {
  const order = getOrderById(db, locationId, orderId)
  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404, { order_id: orderId })
  }

  const base = {
    stage,
    order_id: order.id,
    order_type: order.orderType,
    token_number: order.tokenNumber,
    table_id: order.tableId,
    customer_name: order.customerName,
  }

  if (stage === 'ORDERING') {
    const invoice = getIssuedInvoiceByOrderId(db, locationId, orderId)
    if (invoice) {
      return {
        ...base,
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        line_items: JSON.parse(invoice.lineItemsJson),
        totals: {
          subtotal_cents: invoice.subtotalCents,
          tax_cents: invoice.taxCents,
          discount_cents: invoice.discountCents,
          tip_cents: invoice.tipCents,
          total_cents: invoice.totalCents,
        },
        tax_breakdown: JSON.parse(invoice.taxBreakdownJson),
        cashier_name: invoice.cashierName,
      }
    }

    const lines = listOrderLines(db, orderId).map(toOrderLineDto)
    return {
      ...base,
      lines,
      totals: {
        subtotal_cents: order.subtotalCents,
        tax_cents: order.taxCents,
        discount_cents: order.discountCents,
        tip_cents: order.tipCents,
        total_cents: order.totalCents,
      },
    }
  }

  let lines = listOrderLines(db, orderId)
    .filter((line) => line.isSubmitted)
    .map(toOrderLineDto)

  if (stage === 'KITCHEN') {
    if (submitBatch !== undefined && submitBatch !== null) {
      lines = lines.filter((line) => line.submit_batch === submitBatch)
    }
    if (lines.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'No submitted lines available for kitchen print',
        400,
        { order_id: orderId, submit_batch: submitBatch ?? null },
      )
    }
  }

  return {
    ...base,
    submit_batch: submitBatch ?? null,
    lines,
  }
}

/** @throws {AppError} NOT_FOUND when order/printer missing; CONFLICT when stage disabled */
export function enqueuePrintJob(
  db: HubDb,
  locationId: string,
  input: {
    orderId: string
    stage: PrintStageType
    printerId?: string | null
    submitBatch?: number | null
  },
) {
  assertStageEnabled(db, locationId, input.stage)

  const payload = buildPrintPayload(
    db,
    locationId,
    input.orderId,
    input.stage,
    input.submitBatch,
  )
  const printerId = resolvePrinter(
    db,
    locationId,
    input.stage,
    input.printerId,
  )

  const row = createPrintJob(db, locationId, {
    orderId: input.orderId,
    stage: input.stage,
    printerId,
    submitBatch: input.submitBatch ?? null,
    payloadJson: JSON.stringify(payload),
  })

  return toPrintJobDto(row)
}

/** @throws {AppError} NOT_FOUND when job missing; VALIDATION_ERROR on invalid transition */
export function updatePrintJobStatus(
  db: HubDb,
  locationId: string,
  jobId: string,
  status: PrintJobStatus,
) {
  const job = getPrintJobById(db, locationId, jobId)
  if (!job) {
    throw new AppError('NOT_FOUND', 'Print job not found', 404, { id: jobId })
  }

  const allowed = STATUS_TRANSITIONS[job.status] ?? []
  if (!allowed.includes(status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid status transition from ${job.status} to ${status}`,
      400,
      { from: job.status, to: status },
    )
  }

  const updated = persistPrintJobStatus(db, locationId, jobId, status, {
    incrementAttempts: status === 'FAILED',
  })
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Print job not found', 404, { id: jobId })
  }

  return toPrintJobDto(updated)
}
