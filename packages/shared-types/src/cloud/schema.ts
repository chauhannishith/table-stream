import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core'

const cloudTimestamps = {
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...cloudTimestamps,
})

export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  hubId: text('hub_id').notNull(),
  cloudSyncEnabled: boolean('cloud_sync_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...cloudTimestamps,
})

export const orgBusinessProfiles = pgTable('org_business_profiles', {
  orgId: text('org_id').primaryKey(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  gstNumber: text('gst_number').notNull(),
  addressLinesJson: jsonb('address_lines_json').notNull().default({}),
  phone: text('phone').notNull(),
  email: text('email'),
  logoUrl: text('logo_url'),
  ...cloudTimestamps,
})

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  currentPeriodEnd: timestamp('current_period_end', {
    withTimezone: true,
  }).notNull(),
  ...cloudTimestamps,
})

export const hubEntitlements = pgTable('hub_entitlements', {
  hubId: text('hub_id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  enabled: boolean('enabled').notNull().default(true),
  disabledReason: text('disabled_reason'),
  ...cloudTimestamps,
})

/** Immutable operational sync events (data plane) */
export const syncRecords = pgTable('sync_records', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  locationId: text('location_id').notNull(),
  hubId: text('hub_id').notNull(),
  eventType: text('event_type').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  payload: jsonb('payload').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/** Materialized reporting projections */
export const ordersFact = pgTable('orders_fact', {
  orderId: text('order_id').primaryKey(),
  orgId: text('org_id').notNull(),
  locationId: text('location_id').notNull(),
  orderType: text('order_type').notNull(),
  itemCount: integer('item_count').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
})

export const paymentsFact = pgTable('payments_fact', {
  paymentId: text('payment_id').primaryKey(),
  orgId: text('org_id').notNull(),
  locationId: text('location_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  tenderType: text('tender_type'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
})

export const dailyLocationTotals = pgTable(
  'daily_location_totals',
  {
    orgId: text('org_id').notNull(),
    locationId: text('location_id').notNull(),
    day: text('day').notNull(),
    orderCount: integer('order_count').notNull().default(0),
    revenueCents: integer('revenue_cents').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.locationId, t.day] })],
)

export const cloudSchema = {
  organizations,
  locations,
  orgBusinessProfiles,
  subscriptions,
  hubEntitlements,
  syncRecords,
  ordersFact,
  paymentsFact,
  dailyLocationTotals,
}

export type CloudSchema = typeof cloudSchema
