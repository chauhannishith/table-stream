import { sql } from 'drizzle-orm'
import {
  integer,
  sqliteTable,
  text,
  primaryKey,
} from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ...timestamps,
})

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  hubId: text('hub_id').notNull(),
  cloudSyncEnabled: integer('cloud_sync_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  configJson: text('config_json').notNull().default('{}'),
  syncCursor: text('sync_cursor'),
  syncState: text('sync_state').notNull().default('LOCAL_ONLY'),
  backfillCursor: text('backfill_cursor'),
  backfillStartedAt: text('backfill_started_at'),
  backfillCompletedAt: text('backfill_completed_at'),
  hubStatus: text('hub_status').notNull().default('ACTIVE'),
  licenseLastCheckedAt: text('license_last_checked_at'),
  suspendedAt: text('suspended_at'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const hubBusinessProfileCache = sqliteTable(
  'hub_business_profile_cache',
  {
    orgId: text('org_id').primaryKey(),
    legalName: text('legal_name').notNull(),
    tradeName: text('trade_name'),
    gstNumber: text('gst_number').notNull(),
    addressLinesJson: text('address_lines_json').notNull().default('{}'),
    phone: text('phone').notNull(),
    email: text('email'),
    logoPath: text('logo_path'),
    fetchedAt: text('fetched_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
)

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  deviceType: text('device_type').notNull(),
  name: text('name').notNull(),
  deviceTokenHash: text('device_token_hash').notNull(),
  assignedZoneIdsJson: text('assigned_zone_ids_json'),
  assignedStationIdsJson: text('assigned_station_ids_json'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastSeenAt: text('last_seen_at'),
  pairedAt: text('paired_at').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  name: text('name').notNull(),
  role: text('role').notNull(),
  pinHash: text('pin_hash').notNull(),
  permissionsJson: text('permissions_json').notNull().default('{}'),
  assignedZoneIdsJson: text('assigned_zone_ids_json')
    .notNull()
    .default('[]'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const locationBillingConfig = sqliteTable('location_billing_config', {
  locationId: text('location_id')
    .primaryKey()
    .references(() => locations.id),
  taxRulesJson: text('tax_rules_json').notNull().default('{}'),
  priceTaxMode: text('price_tax_mode').notNull().default('EXCLUSIVE'),
  serviceChargeRulesJson: text('service_charge_rules_json')
    .notNull()
    .default('{}'),
  tipQuickActionsJson: text('tip_quick_actions_json')
    .notNull()
    .default('[]'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const zones = sqliteTable('zones', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const tables = sqliteTable('tables', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  zoneId: text('zone_id')
    .notNull()
    .references(() => zones.id),
  label: text('label').notNull(),
  capacity: integer('capacity').notNull().default(2),
  posX: integer('pos_x'),
  posY: integer('pos_y'),
  status: text('status').notNull().default('AVAILABLE'),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const kdsStations = sqliteTable('kds_stations', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const menuCategories = sqliteTable('menu_categories', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const menuTags = sqliteTable('menu_tags', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  code: text('code').notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const menuItemTags = sqliteTable(
  'menu_item_tags',
  {
    menuItemId: text('menu_item_id')
      .notNull()
      .references(() => menuItems.id),
    tagId: text('tag_id')
      .notNull()
      .references(() => menuTags.id),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.tagId] })],
)

export const modifierGroups = sqliteTable('modifier_groups', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  scope: text('scope').notNull(),
  categoryId: text('category_id').references(() => menuCategories.id),
  menuItemId: text('menu_item_id').references(() => menuItems.id),
  name: text('name').notNull(),
  minSelect: integer('min_select').notNull().default(0),
  maxSelect: integer('max_select'),
  isRequired: integer('is_required', { mode: 'boolean' })
    .notNull()
    .default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const modifierOptions = sqliteTable('modifier_options', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => modifierGroups.id),
  code: text('code').notNull(),
  label: text('label').notNull(),
  priceCents: integer('price_cents').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  categoryId: text('category_id')
    .notNull()
    .references(() => menuCategories.id),
  name: text('name').notNull(),
  basePriceCents: integer('base_price_cents').notNull(),
  kdsStationId: text('kds_station_id').references(() => kdsStations.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const menuItemZonePrices = sqliteTable(
  'menu_item_zone_prices',
  {
    menuItemId: text('menu_item_id')
      .notNull()
      .references(() => menuItems.id),
    zoneId: text('zone_id')
      .notNull()
      .references(() => zones.id),
    priceCents: integer('price_cents').notNull(),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.zoneId] })],
)

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  orderType: text('order_type').notNull(),
  tableId: text('table_id').references(() => tables.id),
  zoneId: text('zone_id')
    .notNull()
    .references(() => zones.id),
  tokenNumber: text('token_number'),
  customerName: text('customer_name'),
  customerContact: text('customer_contact'),
  status: text('status').notNull().default('DRAFT'),
  fulfillmentStatus: text('fulfillment_status'),
  serverId: text('server_id').references(() => staff.id),
  discountType: text('discount_type'),
  discountValue: integer('discount_value'),
  discountCents: integer('discount_cents').notNull().default(0),
  serviceChargeCents: integer('service_charge_cents').notNull().default(0),
  tipCents: integer('tip_cents').notNull().default(0),
  version: integer('version').notNull().default(1),
  openedAt: text('opened_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  closedAt: text('closed_at'),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
})

export const orderLines = sqliteTable('order_lines', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  menuItemId: text('menu_item_id').notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull(),
  taxCents: integer('tax_cents').notNull().default(0),
  lineTotalCents: integer('line_total_cents').notNull(),
  modifiersJson: text('modifiers_json').notNull().default('[]'),
  tagsJson: text('tags_json').notNull().default('[]'),
  specialInstructions: text('special_instructions'),
  kdsStationId: text('kds_station_id').references(() => kdsStations.id),
  status: text('status').notNull().default('DRAFT'),
  isSubmitted: integer('is_submitted', { mode: 'boolean' })
    .notNull()
    .default(false),
  submittedAt: text('submitted_at'),
  submitBatch: integer('submit_batch').notNull().default(0),
  kdsVisible: integer('kds_visible', { mode: 'boolean' })
    .notNull()
    .default(false),
  version: integer('version').notNull().default(1),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  status: text('status').notNull().default('PENDING'),
  amountCents: integer('amount_cents').notNull(),
  tenderType: text('tender_type'),
  provider: text('provider'),
  providerRef: text('provider_ref'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  paymentId: text('payment_id').references(() => payments.id),
  invoiceNumber: text('invoice_number').notNull(),
  status: text('status').notNull().default('ISSUED'),
  issuedAt: text('issued_at').notNull(),
  voidedAt: text('voided_at'),
  voidReason: text('void_reason'),
  replacesInvoiceId: text('replaces_invoice_id'),
  subtotalCents: integer('subtotal_cents').notNull(),
  taxCents: integer('tax_cents').notNull(),
  discountCents: integer('discount_cents').notNull().default(0),
  tipCents: integer('tip_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  tenderSummaryJson: text('tender_summary_json').notNull().default('{}'),
  lineItemsJson: text('line_items_json').notNull().default('[]'),
  cashierId: text('cashier_id').references(() => staff.id),
  cashierName: text('cashier_name').notNull(),
  tokenNumber: text('token_number').notNull(),
  businessSnapshotJson: text('business_snapshot_json').notNull().default('{}'),
  taxBreakdownJson: text('tax_breakdown_json').notNull().default('{}'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  documentPath: text('document_path'),
  contentHash: text('content_hash').notNull(),
})

export const locationPrintConfig = sqliteTable('location_print_config', {
  locationId: text('location_id')
    .primaryKey()
    .references(() => locations.id),
  printStagesJson: text('print_stages_json').notNull().default('{}'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const printers = sqliteTable('printers', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  name: text('name').notNull(),
  role: text('role').notNull(),
  connectionJson: text('connection_json').notNull().default('{}'),
  kdsStationIdsJson: text('kds_station_ids_json'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const printJobs = sqliteTable('print_jobs', {
  id: text('id').primaryKey(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  stage: text('stage').notNull(),
  printerId: text('printer_id').references(() => printers.id),
  submitBatch: integer('submit_batch'),
  payloadJson: text('payload_json').notNull().default('{}'),
  status: text('status').notNull().default('PENDING'),
  attemptCount: integer('attempt_count').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const syncOutbox = sqliteTable('sync_outbox', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  status: text('status').notNull().default('PENDING'),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptAt: text('next_attempt_at').notNull(),
  lastError: text('last_error'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const appliedEvents = sqliteTable('applied_events', {
  eventId: text('event_id').primaryKey(),
  appliedAt: text('applied_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const hubSchema = {
  organizations,
  locations,
  hubBusinessProfileCache,
  devices,
  staff,
  locationBillingConfig,
  zones,
  tables,
  kdsStations,
  menuCategories,
  menuTags,
  menuItems,
  menuItemTags,
  modifierGroups,
  modifierOptions,
  menuItemZonePrices,
  orders,
  orderLines,
  payments,
  invoices,
  locationPrintConfig,
  printers,
  printJobs,
  syncOutbox,
  appliedEvents,
}

export type HubSchema = typeof hubSchema
