import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { ZonesSetupScreen } from '../src/features/setup/zones/ZonesSetupScreen'
import { createTestRender } from './create-test-render'

describe('ZonesSetupScreen (MSW CRUD)', () => {
  it('creates, renames, and deactivates a zone with tax rules', async () => {
    const { user } = createTestRender(<ZonesSetupScreen />)

    expect(await screen.findByText(/No zones yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New zone' }))
    await user.type(screen.getByLabelText('Name'), 'Patio')
    await user.type(screen.getByLabelText('Tax key 1'), 'gst')
    await user.type(screen.getByLabelText('Tax percent 1'), '18')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Patio')).toBeInTheDocument()
    expect(screen.getByText(/gst 18%/i)).toBeInTheDocument()

    const patioRow = screen.getByText('Patio').closest('li')
    expect(patioRow).toBeTruthy()
    await user.click(
      within(patioRow as HTMLElement).getByRole('button', { name: 'Edit' }),
    )
    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Garden patio')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Garden patio')).toBeInTheDocument()

    const editedRow = screen.getByText('Garden patio').closest('li')
    await user.click(
      within(editedRow as HTMLElement).getByRole('button', {
        name: 'Deactivate',
      }),
    )

    await waitFor(() => {
      expect(screen.getByText(/Inactive/i)).toBeInTheDocument()
    })
    expect(
      within(screen.getByText('Garden patio').closest('li') as HTMLElement).getByRole(
        'button',
        { name: 'Reactivate' },
      ),
    ).toBeInTheDocument()
  })
})
