import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { MenuItemsSetupScreen } from '../src/features/setup/menu-items/MenuItemsSetupScreen'
import { createTestRender } from './create-test-render'

describe('MenuItemsSetupScreen (MSW CRUD)', () => {
  it('creates, renames, and deactivates a menu item with category', async () => {
    const { user } = createTestRender(<MenuItemsSetupScreen />)

    expect(await screen.findByText(/No menu items yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New item' }))
    await user.type(screen.getByLabelText('Name'), 'Curry')
    await user.type(screen.getByLabelText('Category name'), 'Mains')
    await user.clear(screen.getByLabelText('Base price'))
    await user.type(screen.getByLabelText('Base price'), '12.50')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Curry')).toBeInTheDocument()
    expect(screen.getByText('Mains')).toBeInTheDocument()
    expect(screen.getByText(/12\.50/)).toBeInTheDocument()

    const curryRow = screen.getByText('Curry').closest('li')
    expect(curryRow).toBeTruthy()
    await user.click(
      within(curryRow as HTMLElement).getByRole('button', { name: 'Edit' }),
    )
    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'House curry')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('House curry')).toBeInTheDocument()

    const editedRow = screen.getByText('House curry').closest('li')
    await user.click(
      within(editedRow as HTMLElement).getByRole('button', {
        name: 'Deactivate',
      }),
    )

    await waitFor(() => {
      expect(screen.getByText(/Inactive/i)).toBeInTheDocument()
    })
    expect(
      within(
        screen.getByText('House curry').closest('li') as HTMLElement,
      ).getByRole('button', { name: 'Reactivate' }),
    ).toBeInTheDocument()
  })
})
