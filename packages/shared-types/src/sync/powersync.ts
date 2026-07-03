/**
 * PowerSync bucket definitions — Postgres WAL → SQLite row replication.
 * Cloud PostgreSQL is source of truth for replicated tables;
 * edge SQLite receives rows for offline-capable client apps (tablet-pos).
 *
 * @see https://docs.powersync.com/
 */

import { CLOUD_TABLES, HUB_TABLES } from '../domain/tables.js'

/** Tables replicated from cloud Postgres to edge SQLite via PowerSync */
export const POWERSYNC_CLOUD_TO_EDGE_TABLES = [
  CLOUD_TABLES.organizations,
  CLOUD_TABLES.locations,
  CLOUD_TABLES.orgBusinessProfiles,
  CLOUD_TABLES.subscriptions,
  CLOUD_TABLES.hubEntitlements,
] as const

/**
 * Hub-authoritative tables — written on edge-server, optionally uplinked
 * as events to cloud data plane (not row-replicated via PowerSync).
 */
export const EDGE_AUTHORITATIVE_TABLES = [
  HUB_TABLES.orders,
  HUB_TABLES.orderLines,
  HUB_TABLES.payments,
  HUB_TABLES.invoices,
  HUB_TABLES.menuCategories,
  HUB_TABLES.menuTags,
  HUB_TABLES.menuItemTags,
  HUB_TABLES.modifierGroups,
  HUB_TABLES.modifierOptions,
  HUB_TABLES.menuItems,
  HUB_TABLES.menuItemZonePrices,
  HUB_TABLES.zones,
  HUB_TABLES.tables,
  HUB_TABLES.staff,
  HUB_TABLES.devices,
] as const

/** Tables that never leave the hub device */
export const EDGE_LOCAL_ONLY_TABLES = [
  HUB_TABLES.invoices,
  HUB_TABLES.printJobs,
  HUB_TABLES.syncOutbox,
  HUB_TABLES.appliedEvents,
] as const

export type PowerSyncCloudToEdgeTable =
  (typeof POWERSYNC_CLOUD_TO_EDGE_TABLES)[number]

export const powersyncSyncRulesYaml = `
bucket_definitions:
  org_config:
    parameters: SELECT request.user_id() AS org_id
    data:
      - SELECT * FROM ${CLOUD_TABLES.orgBusinessProfiles} WHERE org_id = bucket.org_id
      - SELECT * FROM ${CLOUD_TABLES.subscriptions} WHERE org_id = bucket.org_id
      - SELECT * FROM ${CLOUD_TABLES.hubEntitlements} WHERE org_id = bucket.org_id
      - SELECT * FROM ${CLOUD_TABLES.locations} WHERE org_id = bucket.org_id
      - SELECT * FROM ${CLOUD_TABLES.organizations} WHERE id = bucket.org_id
`.trim()
