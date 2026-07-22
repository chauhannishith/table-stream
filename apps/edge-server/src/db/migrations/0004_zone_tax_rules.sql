-- Zone-based tax rates (E11.1)
-- Empty '{}' inherits location_billing_config.tax_rules_json at bill time.

ALTER TABLE zones ADD COLUMN tax_rules_json TEXT NOT NULL DEFAULT '{}';
