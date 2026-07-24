import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { CategoryEditor } from '../src/features/setup/categories/CategoryEditor'
import { createTestRender } from './create-test-render'

describe('CategoryEditor', () => {
  it('submits trimmed name on create', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = createTestRender(
      <CategoryEditor
        title="Create category"
        initialName=""
        submitLabel="Create"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Mains')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Mains' })
    })
  })

  it('surfaces onSubmit errors', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('name is required')
    })
    const { user } = createTestRender(
      <CategoryEditor
        title="Create category"
        initialName="X"
        submitLabel="Create"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })
})
