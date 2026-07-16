import { describe, expect, it } from 'vitest'
import {
  buildModifierSnapshots,
  buildTagSnapshots,
  modifierExtraCents,
} from './snapshots.js'

describe('buildModifierSnapshots', () => {
  it('copies option price and label at snapshot time', () => {
    const options = new Map([
      [
        'opt_jal',
        {
          id: 'opt_jal',
          code: 'jalapeno',
          label: 'Jalapeño',
          priceCents: 150,
          groupId: 'grp_extras',
          groupName: 'Extra toppings',
          groupScope: 'ITEM' as const,
        },
      ],
    ])

    const snapshots = buildModifierSnapshots(
      [{ option_id: 'opt_jal', quantity: 2 }],
      options,
    )

    expect(snapshots).toEqual([
      {
        kind: 'item_option',
        group_id: 'grp_extras',
        group_name: 'Extra toppings',
        option_id: 'opt_jal',
        code: 'jalapeno',
        label: 'Jalapeño',
        price_cents: 150,
        quantity: 2,
      },
    ])
    expect(modifierExtraCents(snapshots)).toBe(300)
  })

  it('throws when an option is missing', () => {
    expect(() =>
      buildModifierSnapshots([{ option_id: 'missing' }], new Map()),
    ).toThrow('Modifier option not found: missing')
  })
})

describe('buildTagSnapshots', () => {
  it('copies tag id code and label', () => {
    expect(
      buildTagSnapshots([{ id: 'tag_1', code: 'vegan', label: 'Vegan' }]),
    ).toEqual([{ tag_id: 'tag_1', code: 'vegan', label: 'Vegan' }])
  })
})
