import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { CategoriesSetupScreen } from '../src/features/setup/categories/CategoriesSetupScreen'
import { createTestRender } from './create-test-render'

describe('CategoriesSetupScreen (MSW CRUD)', () => {
  it('creates, renames, and toggles category active state', async () => {
    const { user } = createTestRender(<CategoriesSetupScreen />)

    expect(await screen.findByText(/No categories yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New category' }))
    await user.type(screen.getByLabelText('Name'), 'Mains')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Mains')).toBeInTheDocument()
    expect(screen.getByText(/Active/)).toBeInTheDocument()

    const mainsRow = screen.getByText('Mains').closest('li')
    expect(mainsRow).toBeTruthy()
    await user.click(
      within(mainsRow as HTMLElement).getByRole('button', { name: 'Edit' }),
    )
    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Entrees')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Entrees')).toBeInTheDocument()

    const editedRow = screen.getByText('Entrees').closest('li')
    await user.click(
      within(editedRow as HTMLElement).getByRole('button', {
        name: 'Deactivate',
      }),
    )

    await waitFor(() => {
      expect(screen.getByText(/Inactive/i)).toBeInTheDocument()
    })
    expect(
      within(screen.getByText('Entrees').closest('li') as HTMLElement).getByRole(
        'button',
        { name: 'Reactivate' },
      ),
    ).toBeInTheDocument()
  })
})
