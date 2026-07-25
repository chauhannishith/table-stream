import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import {
  ModifierGroupEditor,
  parseMaxSelect,
  parseMinSelect,
} from '../src/features/setup/modifiers/ModifierGroupEditor'
import { createTestRender } from './create-test-render'

describe('modifier group parsers', () => {
  it('parses min and max select values', () => {
    expect(parseMinSelect('0')).toBe(0)
    expect(parseMinSelect('2')).toBe(2)
    expect(parseMaxSelect('')).toBeNull()
    expect(parseMaxSelect('3')).toBe(3)
    expect(() => parseMinSelect('-1')).toThrow(/non-negative/)
    expect(() => parseMaxSelect('1.5')).toThrow(/non-negative integer/)
  })
})

describe('ModifierGroupEditor', () => {
  it('submits name and selection rules', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = createTestRender(
      <ModifierGroupEditor
        title="Create group"
        initialName=""
        initialMinSelect={0}
        initialMaxSelect={null}
        initialIsRequired={false}
        submitLabel="Create"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Extras')
    await user.clear(screen.getByLabelText('Min select'))
    await user.type(screen.getByLabelText('Min select'), '1')
    await user.type(screen.getByLabelText('Max select'), '2')
    await user.click(screen.getByLabelText('Required'))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Extras',
        min_select: 1,
        max_select: 2,
        is_required: true,
      })
    })
  })
})
