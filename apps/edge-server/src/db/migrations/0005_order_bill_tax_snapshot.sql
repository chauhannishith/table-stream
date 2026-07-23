ALTER TABLE orders
ADD COLUMN bill_tax_snapshot_json TEXT NOT NULL DEFAULT '{}';
