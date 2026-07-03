-- Hub SQLite initial schema (mirrors @table-stream/shared-types hub schema)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  hub_id TEXT NOT NULL,
  cloud_sync_enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  sync_cursor TEXT,
  sync_state TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  backfill_cursor TEXT,
  backfill_started_at TEXT,
  backfill_completed_at TEXT,
  hub_status TEXT NOT NULL DEFAULT 'ACTIVE',
  license_last_checked_at TEXT,
  suspended_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_business_profile_cache (
  org_id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  gst_number TEXT NOT NULL,
  address_lines_json TEXT NOT NULL DEFAULT '{}',
  phone TEXT NOT NULL,
  email TEXT,
  logo_path TEXT,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  device_type TEXT NOT NULL,
  name TEXT NOT NULL,
  device_token_hash TEXT NOT NULL,
  assigned_zone_ids_json TEXT,
  assigned_station_ids_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  paired_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '{}',
  assigned_zone_ids_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS location_billing_config (
  location_id TEXT PRIMARY KEY REFERENCES locations(id),
  tax_rules_json TEXT NOT NULL DEFAULT '{}',
  price_tax_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
  service_charge_rules_json TEXT NOT NULL DEFAULT '{}',
  tip_quick_actions_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  zone_id TEXT NOT NULL REFERENCES zones(id),
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  pos_x INTEGER,
  pos_y INTEGER,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kds_stations (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  base_price_cents INTEGER NOT NULL,
  kds_station_id TEXT REFERENCES kds_stations(id),
  modifier_groups_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_item_zone_prices (
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  zone_id TEXT NOT NULL REFERENCES zones(id),
  price_cents INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (menu_item_id, zone_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  order_type TEXT NOT NULL,
  table_id TEXT REFERENCES tables(id),
  zone_id TEXT NOT NULL REFERENCES zones(id),
  token_number TEXT,
  customer_name TEXT,
  customer_contact TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  fulfillment_status TEXT,
  server_id TEXT REFERENCES staff(id),
  discount_type TEXT,
  discount_value INTEGER,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  service_charge_cents INTEGER NOT NULL DEFAULT 0,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL,
  modifiers_json TEXT NOT NULL DEFAULT '[]',
  special_instructions TEXT,
  kds_station_id TEXT REFERENCES kds_stations(id),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  is_submitted INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  submit_batch INTEGER NOT NULL DEFAULT 0,
  kds_visible INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount_cents INTEGER NOT NULL,
  tender_type TEXT,
  provider TEXT,
  provider_ref TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT REFERENCES payments(id),
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  issued_at TEXT NOT NULL,
  voided_at TEXT,
  void_reason TEXT,
  replaces_invoice_id TEXT,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  tender_summary_json TEXT NOT NULL DEFAULT '{}',
  line_items_json TEXT NOT NULL DEFAULT '[]',
  cashier_id TEXT REFERENCES staff(id),
  cashier_name TEXT NOT NULL,
  token_number TEXT NOT NULL,
  business_snapshot_json TEXT NOT NULL DEFAULT '{}',
  tax_breakdown_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  document_path TEXT,
  content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS location_print_config (
  location_id TEXT PRIMARY KEY REFERENCES locations(id),
  print_stages_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS printers (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  connection_json TEXT NOT NULL DEFAULT '{}',
  kds_station_ids_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  stage TEXT NOT NULL,
  printer_id TEXT REFERENCES printers(id),
  submit_batch INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applied_events (
  event_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
