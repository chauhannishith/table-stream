import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import {
  ModifierOptionEditor,
  priceExtraToCents,
} from '../src/features/setup/modifiers/ModifierOptionEditor'
import { createTestRender } from './create-test-render'

describe('priceExtraToCents', () => {
  it('treats blank as zero and parses decimals', () => {
    expect(priceExtraToCents('')).toBe(0)
    expect(priceExtraToCents('1.5')).toBe(150)
    expect(() => priceExtraToCents('-1')).toThrow(/non-negative/)
  })
})

describe('ModifierOptionEditor', () => {
  it('updates price preview and submits price extra', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = createTestRender(
      <ModifierOptionEditor
        title="Create option"
        initialCode=""
        initialLabel=""
        initialPriceCents={0}
        initialIsDefault={false}
        submitLabel="Create"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByText(/Preview: \+0\.00/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Code'), 'cheese')
    await user.type(screen.getByLabelText('Label'), 'Extra cheese')
    await user.clear(screen.getByLabelText('Price extra'))
    await user.type(screen.getByLabelText('Price extra'), '1.50')

    expect(screen.getByText(/Preview: \+1\.50/)).toBeInTheDocument()

    await user.click(screen.getByLabelText('Default option'))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        code: 'cheese',
        label: 'Extra cheese',
        price_cents: 150,
        is_default: true,
      })
    })
  })
})
