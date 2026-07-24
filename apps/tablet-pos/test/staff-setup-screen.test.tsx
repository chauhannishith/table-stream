import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { StaffSetupScreen } from '../src/features/setup/staff/StaffSetupScreen'
import { createTestRender } from './create-test-render'

describe('StaffSetupScreen (MSW CRUD)', () => {
  it('creates waiter and admin, edits role, and deactivates', async () => {
    const { user } = createTestRender(<StaffSetupScreen />)

    expect(await screen.findByText(/No staff yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New staff' }))
    await user.type(screen.getByLabelText('Name'), 'Alex')
    await user.selectOptions(screen.getByLabelText('Role'), 'WAITER')
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Alex')).toBeInTheDocument()
    expect(screen.getByText(/WAITER/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New staff' }))
    await user.type(screen.getByLabelText('Name'), 'Sam')
    await user.selectOptions(screen.getByLabelText('Role'), 'ADMIN')
    await user.type(screen.getByLabelText('PIN'), '9999')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Sam')).toBeInTheDocument()
    expect(screen.getByText(/ADMIN/)).toBeInTheDocument()

    const alexRow = screen.getByText('Alex').closest('li')
    expect(alexRow).toBeTruthy()
    await user.click(
      within(alexRow as HTMLElement).getByRole('button', { name: 'Edit' }),
    )
    await user.selectOptions(screen.getByLabelText('Role'), 'COUNTER')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(
        within(screen.getByText('Alex').closest('li') as HTMLElement).getByText(
          /COUNTER/,
        ),
      ).toBeInTheDocument()
    })

    const editedRow = screen.getByText('Alex').closest('li')
    await user.click(
      within(editedRow as HTMLElement).getByRole('button', {
        name: 'Deactivate',
      }),
    )

    await waitFor(() => {
      expect(
        within(screen.getByText('Alex').closest('li') as HTMLElement).getByText(
          /Inactive/,
        ),
      ).toBeInTheDocument()
    })
    expect(
      within(screen.getByText('Alex').closest('li') as HTMLElement).getByRole(
        'button',
        { name: 'Reactivate' },
      ),
    ).toBeInTheDocument()
  })
})
