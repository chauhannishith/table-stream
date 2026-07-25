import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { ModifiersSetupScreen } from '../src/features/setup/modifiers/ModifiersSetupScreen'
import { createCategory, createMenuItem } from '../src/lib/menu-api'
import { createTestRender } from './create-test-render'

describe('ModifiersSetupScreen (MSW)', () => {
  it('adds an item-scoped option and shows price extra in the list', async () => {
    const category = await createCategory({ name: 'Mains' })
    await createMenuItem({
      category_id: category.id,
      name: 'Curry',
      base_price_cents: 1299,
    })

    const { user } = createTestRender(<ModifiersSetupScreen />)

    expect(await screen.findByLabelText('Menu item')).toBeInTheDocument()
    expect(screen.getByText(/No modifier groups yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New group' }))
    await user.type(screen.getByLabelText('Name'), 'Extras')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Extras')).toBeInTheDocument()

    const groupRow = screen.getByText('Extras').closest('li')
    expect(groupRow).toBeTruthy()
    await user.click(
      within(groupRow as HTMLElement).getByRole('button', {
        name: 'Add option',
      }),
    )
    await user.type(screen.getByLabelText('Code'), 'cheese')
    await user.type(screen.getByLabelText('Label'), 'Extra cheese')
    await user.clear(screen.getByLabelText('Price extra'))
    await user.type(screen.getByLabelText('Price extra'), '1.50')
    expect(screen.getByText(/Preview: \+1\.50/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Extra cheese')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/\+1\.50/)).toBeInTheDocument()
    })
  })
})
