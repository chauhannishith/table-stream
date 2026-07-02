-- Cloud ledger schema (Supabase-compatible PostgreSQL)
-- Mirrors packages/shared-types/src/cloud/schema.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  hub_id TEXT NOT NULL,
  cloud_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE org_business_profiles (
  org_id TEXT PRIMARY KEY REFERENCES organizations(id),
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  gst_number TEXT NOT NULL,
  address_lines_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone TEXT NOT NULL,
  email TEXT,
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_entitlements (
  hub_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sync_records (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  hub_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders_fact (
  order_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  order_type TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments_fact (
  payment_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  tender_type TEXT,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE daily_location_totals (
  org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  day TEXT NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, location_id, day)
);

-- Demo seed (matches apps/edge-server/hub.config.yaml)
INSERT INTO organizations (id, name) VALUES ('org_demo', 'Demo Restaurant Group');

INSERT INTO locations (id, org_id, name, timezone, hub_id, cloud_sync_enabled)
VALUES ('loc_demo', 'org_demo', 'Demo Restaurant', 'Asia/Kolkata', 'hub_demo_001', FALSE);

INSERT INTO org_business_profiles (org_id, legal_name, gst_number, phone, address_lines_json)
VALUES (
  'org_demo',
  'Demo Restaurant Pvt Ltd',
  '29ABCDE1234F1Z5',
  '+91-9000000000',
  '{"lines":["123 Main St","Bengaluru"]}'::jsonb
);

INSERT INTO subscriptions (id, org_id, plan, status, current_period_end)
VALUES ('sub_demo', 'org_demo', 'standard', 'ACTIVE', '2026-12-31T00:00:00Z');

INSERT INTO hub_entitlements (hub_id, org_id, location_id, enabled)
VALUES ('hub_demo_001', 'org_demo', 'loc_demo', TRUE);

-- PowerSync logical replication publication (WAL → client SQLite)
CREATE PUBLICATION powersync FOR TABLE
  organizations,
  locations,
  org_business_profiles,
  subscriptions,
  hub_entitlements,
  sync_records,
  orders_fact,
  payments_fact,
  daily_location_totals;
