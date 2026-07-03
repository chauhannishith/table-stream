-- Menu catalog: categories, tags, modifier groups/options
-- Replaces menu_items.category text + modifier_groups_json

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_tags (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (location_id, code)
);

-- Seed one category per location from legacy menu_items.category values
INSERT INTO menu_categories (id, location_id, name)
SELECT
  'cat_' || location_id || '_' || lower(replace(trim(category), ' ', '_')),
  location_id,
  trim(category)
FROM menu_items
GROUP BY location_id, trim(category);

CREATE TABLE IF NOT EXISTS menu_items_new (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  base_price_cents INTEGER NOT NULL,
  kds_station_id TEXT REFERENCES kds_stations(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO menu_items_new (
  id, location_id, category_id, name, base_price_cents, kds_station_id, is_active, updated_at
)
SELECT
  mi.id,
  mi.location_id,
  mc.id,
  mi.name,
  mi.base_price_cents,
  mi.kds_station_id,
  mi.is_active,
  mi.updated_at
FROM menu_items mi
JOIN menu_categories mc
  ON mc.location_id = mi.location_id
 AND mc.name = trim(mi.category);

DROP TABLE menu_items;
ALTER TABLE menu_items_new RENAME TO menu_items;

CREATE TABLE IF NOT EXISTS menu_item_tags (
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  tag_id TEXT NOT NULL REFERENCES menu_tags(id),
  PRIMARY KEY (menu_item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  scope TEXT NOT NULL CHECK (scope IN ('CATEGORY', 'ITEM')),
  category_id TEXT REFERENCES menu_categories(id),
  menu_item_id TEXT REFERENCES menu_items(id),
  name TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER,
  is_required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (scope = 'CATEGORY' AND category_id IS NOT NULL AND menu_item_id IS NULL)
    OR (scope = 'ITEM' AND menu_item_id IS NOT NULL AND category_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES modifier_groups(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (group_id, code)
);

ALTER TABLE order_lines ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';

PRAGMA foreign_keys = ON;
