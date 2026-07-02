/** Hub (edge) and cloud PostgreSQL table names — single source of truth */

export const HUB_TABLES = {
  organizations: 'organizations',
  locations: 'locations',
  hubBusinessProfileCache: 'hub_business_profile_cache',
  devices: 'devices',
  staff: 'staff',
  locationBillingConfig: 'location_billing_config',
  zones: 'zones',
  tables: 'tables',
  menuItems: 'menu_items',
  menuItemZonePrices: 'menu_item_zone_prices',
  kdsStations: 'kds_stations',
  orders: 'orders',
  orderLines: 'order_lines',
  payments: 'payments',
  invoices: 'invoices',
  locationPrintConfig: 'location_print_config',
  printers: 'printers',
  printJobs: 'print_jobs',
  syncOutbox: 'sync_outbox',
  appliedEvents: 'applied_events',
} as const

export const CLOUD_TABLES = {
  orgBusinessProfiles: 'org_business_profiles',
  subscriptions: 'subscriptions',
  hubEntitlements: 'hub_entitlements',
  organizations: 'organizations',
  locations: 'locations',
  syncRecords: 'sync_records',
  ordersFact: 'orders_fact',
  paymentsFact: 'payments_fact',
  dailyLocationTotals: 'daily_location_totals',
} as const

export type HubTableName = (typeof HUB_TABLES)[keyof typeof HUB_TABLES]
export type CloudTableName = (typeof CLOUD_TABLES)[keyof typeof CLOUD_TABLES]
