import { z } from 'zod'

export const HubStatus = z.enum(['ACTIVE', 'SUSPENDED'])
export type HubStatus = z.infer<typeof HubStatus>

export const SyncState = z.enum([
  'LOCAL_ONLY',
  'BACKFILL_RUNNING',
  'SYNCING',
  'BACKFILL_FAILED',
])
export type SyncState = z.infer<typeof SyncState>

export const TableStatus = z.enum([
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'DIRTY',
])
export type TableStatus = z.infer<typeof TableStatus>

export const OrderType = z.enum(['DINE_IN', 'TAKEAWAY'])
export type OrderType = z.infer<typeof OrderType>

export const OrderStatus = z.enum([
  'DRAFT',
  'SUBMITTED',
  'IN_KITCHEN',
  'SERVED',
  'CHECK_PRINTED',
  'PAID',
  'VOID',
])
export type OrderStatus = z.infer<typeof OrderStatus>

export const FulfillmentStatus = z.enum([
  'IN_QUEUE',
  'IN_KITCHEN',
  'BEING_PREPARED',
  'PACKED',
  'AT_COUNTER',
])
export type FulfillmentStatus = z.infer<typeof FulfillmentStatus>

export const OrderLineStatus = z.enum([
  'DRAFT',
  'QUEUED',
  'IN_PROGRESS',
  'PREPARED',
  'SERVED',
  'VOID',
  'RECALLED',
])
export type OrderLineStatus = z.infer<typeof OrderLineStatus>

export const StaffRole = z.enum(['ADMIN', 'COUNTER', 'WAITER'])
export type StaffRole = z.infer<typeof StaffRole>

export const DeviceType = z.enum(['WAITER', 'KITCHEN', 'COUNTER', 'CUSTOMER'])
export type DeviceType = z.infer<typeof DeviceType>

export const PrinterRole = z.enum(['ORDERING', 'KITCHEN', 'COLLECTION'])
export type PrinterRole = z.infer<typeof PrinterRole>

export const PriceTaxMode = z.enum(['INCLUSIVE', 'EXCLUSIVE'])
export type PriceTaxMode = z.infer<typeof PriceTaxMode>

export const DiscountType = z.enum(['PERCENT', 'FIXED'])
export type DiscountType = z.infer<typeof DiscountType>

export const TenderType = z.enum(['CASH', 'CARD', 'OTHER'])
export type TenderType = z.infer<typeof TenderType>

export const PaymentStatus = z.enum([
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
])
export type PaymentStatus = z.infer<typeof PaymentStatus>

export const InvoiceStatus = z.enum(['ISSUED', 'VOIDED'])
export type InvoiceStatus = z.infer<typeof InvoiceStatus>

export const SubscriptionStatus = z.enum([
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED',
])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>

export const PrintJobStatus = z.enum([
  'PENDING',
  'PRINTING',
  'DONE',
  'FAILED',
])
export type PrintJobStatus = z.infer<typeof PrintJobStatus>

export const PrintStage = z.enum(['ORDERING', 'KITCHEN', 'COLLECTION'])
export type PrintStage = z.infer<typeof PrintStage>

export const OutboxStatus = z.enum(['PENDING', 'IN_FLIGHT', 'ACKED', 'DEAD'])
export type OutboxStatus = z.infer<typeof OutboxStatus>

/** Modifier groups attach to a menu category or an individual menu item */
export const ModifierGroupScope = z.enum(['CATEGORY', 'ITEM'])
export type ModifierGroupScope = z.infer<typeof ModifierGroupScope>
