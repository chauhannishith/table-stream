import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'

const HubConfigSchema = z.object({
  org_id: z.string(),
  location_id: z.string(),
  hub_id: z.string(),
  location_name: z.string(),
  timezone: z.string().default('UTC'),
  control_plane: z.object({
    url: z.string(),
  }),
  cloud_sync_enabled: z.boolean().default(false),
  lan: z.object({
    bind: z.string().default('0.0.0.0'),
    port: z.number().default(8443),
    tls_cert: z.string().optional(),
    tls_key: z.string().optional(),
    mdns_name: z.string().default('tablestream-hub'),
  }),
  data_dir: z.string().default('/var/lib/tablestream'),
})

export type HubConfig = z.infer<typeof HubConfigSchema>

export function loadHubConfig(): HubConfig {
  const path =
    process.env.HUB_CONFIG_PATH ??
    resolve(process.cwd(), 'hub.config.yaml')

  if (!existsSync(path)) {
    throw new Error(`Hub config not found: ${path}`)
  }

  const raw = parse(readFileSync(path, 'utf8'))
  return HubConfigSchema.parse(raw)
}

export function loadSubscriptionEnv() {
  return {
    status: process.env.SUBSCRIPTION_STATUS ?? 'ACTIVE',
    periodEnd: process.env.SUBSCRIPTION_PERIOD_END ?? null,
    entitled: process.env.HUB_ENTITLED !== 'false',
    orgLegalName: process.env.ORG_LEGAL_NAME ?? null,
    orgGstNumber: process.env.ORG_GST_NUMBER ?? null,
    orgPhone: process.env.ORG_PHONE ?? null,
  }
}
