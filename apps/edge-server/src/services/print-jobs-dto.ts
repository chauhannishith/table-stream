import type { PrintJobRow } from '../repositories/print-jobs.js'

export function toPrintJobDto(row: PrintJobRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    order_id: row.orderId,
    stage: row.stage,
    printer_id: row.printerId,
    submit_batch: row.submitBatch,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    status: row.status,
    attempt_count: row.attemptCount,
    created_at: row.createdAt,
  }
}
