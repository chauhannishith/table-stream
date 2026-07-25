import {
  PrintStagesConfigSchema,
  type PrintStagesConfig,
} from '@table-stream/shared-types/domain'
import { api, type HubApiClient } from './api-client'

export type PrintConfig = {
  location_id: string
  print_stages: PrintStagesConfig
  updated_at: string | null
}

/** Defaults matching edge hub when no print-config row exists. */
export const DEFAULT_PRINT_STAGES: PrintStagesConfig = {
  ordering: { enabled: true, auto_on_bill: true },
  kitchen: {
    enabled: true,
    auto_on_submit: true,
    split_by_station: true,
    split_by_token: true,
  },
  collection: {
    enabled: true,
    auto_print_dine_in: false,
    auto_print_takeaway: true,
    trigger: 'at_counter',
  },
}

/** Validate print_stages before PUT; throws on incomplete/invalid JSON. */
export function parsePrintStages(raw: unknown): PrintStagesConfig {
  const parsed = PrintStagesConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('Invalid print_stages config')
  }
  return parsed.data
}

/** Load location print stage toggles (defaults when unset on hub). */
export async function getPrintConfig(
  client: HubApiClient = api,
): Promise<PrintConfig> {
  const result = await client.get<{ print_config: PrintConfig }>(
    '/v1/location/print-config',
  )
  return {
    ...result.print_config,
    print_stages: parsePrintStages(result.print_config.print_stages),
  }
}

/** Replace location print stage toggles. */
export async function updatePrintConfig(
  printStages: PrintStagesConfig,
  client: HubApiClient = api,
): Promise<PrintConfig> {
  const print_stages = parsePrintStages(printStages)
  const result = await client.put<{ print_config: PrintConfig }>(
    '/v1/location/print-config',
    { body: { print_stages } },
  )
  return {
    ...result.print_config,
    print_stages: parsePrintStages(result.print_config.print_stages),
  }
}
