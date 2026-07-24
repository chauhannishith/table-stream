import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { StaffEditor } from '../src/features/setup/staff/StaffEditor'
import { createTestRender } from './create-test-render'

describe('StaffEditor', () => {
  it('requires PIN on create and submits name, role, pin', async () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()
    const { user } = createTestRender(
      <StaffEditor
        title="Create staff"
        initialName=""
        initialRole="WAITER"
        requirePin
        submitLabel="Create"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Alex')
    await user.selectOptions(screen.getByLabelText('Role'), 'ADMIN')
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Alex',
        role: 'ADMIN',
        pin: '1234',
      })
    })
  })

  it('omits pin on edit when New PIN is left blank', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = createTestRender(
      <StaffEditor
        title="Edit staff"
        initialName="Sam"
        initialRole="COUNTER"
        requirePin={false}
        submitLabel="Save"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Sam Counter')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Sam Counter',
        role: 'COUNTER',
      })
    })
  })

  it('surfaces invalid PIN errors without calling onSubmit', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = createTestRender(
      <StaffEditor
        title="Create staff"
        initialName=""
        initialRole="WAITER"
        requirePin
        submitLabel="Create"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Alex')
    await user.type(screen.getByLabelText('PIN'), '12')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText(/PIN must be 4–8 digits/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
