import { z } from 'zod'
import { ModifierGroupScope } from './enums.js'

/** Admin-defined label on a menu item (vegan, spicy, contains fish, etc.) */
export const MenuTagSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
})

/** Selectable option within a modifier group (thin crust, jalapeño, etc.) */
export const ModifierOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  price_cents: z.number().int().nonnegative(),
  is_default: z.boolean().optional(),
})

/** Category- or item-scoped customization group configured in admin console */
export const ModifierGroupSchema = z.object({
  id: z.string(),
  scope: ModifierGroupScope,
  name: z.string(),
  min_select: z.number().int().nonnegative().default(0),
  max_select: z.number().int().positive().nullable().optional(),
  is_required: z.boolean().default(false),
  options: z.array(ModifierOptionSchema),
})

/**
 * Immutable snapshot of one selected modifier on an order line.
 * Captured at line-add time — catalog price changes never alter past orders.
 */
export const OrderLineModifierSnapshotSchema = z.object({
  kind: z.enum(['category_option', 'item_option', 'remove']),
  group_id: z.string(),
  group_name: z.string(),
  option_id: z.string(),
  code: z.string(),
  label: z.string(),
  price_cents: z.number().int().nonnegative(),
})

/** Tag labels copied onto the line for KDS / allergen display */
export const OrderLineTagSnapshotSchema = z.object({
  tag_id: z.string(),
  code: z.string(),
  label: z.string(),
})

/** Legacy alias — prefer OrderLineModifierSnapshotSchema for new code */
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

export type MenuTag = z.infer<typeof MenuTagSchema>
export type ModifierOption = z.infer<typeof ModifierOptionSchema>
export type ModifierGroup = z.infer<typeof ModifierGroupSchema>
export type OrderLineModifierSnapshot = z.infer<
  typeof OrderLineModifierSnapshotSchema
>
export type OrderLineTagSnapshot = z.infer<typeof OrderLineTagSnapshotSchema>
export type Modifier = z.infer<typeof ModifierSchema>
export type TaxRules = z.infer<typeof TaxRulesSchema>
export type AddressLines = z.infer<typeof AddressLinesSchema>
export type PrintStagesConfig = z.infer<typeof PrintStagesConfigSchema>
