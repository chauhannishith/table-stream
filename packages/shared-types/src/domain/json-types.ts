import { z } from 'zod'

export const ModifierSchema = z.object({
  type: z.enum(['add', 'remove']),
  code: z.string(),
  label: z.string(),
  price_cents: z.number().int().nonnegative().optional(),
})

export const TaxRulesSchema = z.object({
  components: z.record(z.string(), z.number()),
})

export const AddressLinesSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string().optional(),
  postal: z.string(),
  country: z.string().optional(),
})

export const PrintStagesConfigSchema = z.object({
  ordering: z.object({
    enabled: z.boolean(),
    auto_on_bill: z.boolean(),
  }),
  kitchen: z.object({
    enabled: z.boolean(),
    auto_on_submit: z.boolean(),
    split_by_station: z.boolean(),
    split_by_token: z.boolean(),
  }),
  collection: z.object({
    enabled: z.boolean(),
    auto_print_dine_in: z.boolean(),
    auto_print_takeaway: z.boolean(),
    trigger: z.enum(['at_counter', 'packed', 'manual_only']),
  }),
})

export type Modifier = z.infer<typeof ModifierSchema>
export type TaxRules = z.infer<typeof TaxRulesSchema>
export type AddressLines = z.infer<typeof AddressLinesSchema>
export type PrintStagesConfig = z.infer<typeof PrintStagesConfigSchema>
