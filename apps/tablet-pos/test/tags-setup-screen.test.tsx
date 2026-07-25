import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { TagsSetupScreen } from '../src/features/setup/tags/TagsSetupScreen'
import { createTestRender } from './create-test-render'

describe('TagsSetupScreen (MSW CRUD)', () => {
  it('creates a tag, surfaces duplicate code, and deactivates', async () => {
    const { user } = createTestRender(<TagsSetupScreen />)

    expect(await screen.findByText(/No tags yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New tag' }))
    await user.type(screen.getByLabelText('Code'), 'Vegan')
    await user.type(screen.getByLabelText('Label'), 'Vegan')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Vegan')).toBeInTheDocument()
    expect(screen.getByText(/vegan/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New tag' }))
    await user.type(screen.getByLabelText('Code'), 'vegan')
    await user.type(screen.getByLabelText('Label'), 'Vegan again')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(
      await screen.findByText(/Tag code already exists/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    const tagRow = screen.getByText('Vegan').closest('li')
    expect(tagRow).toBeTruthy()
    await user.click(
      within(tagRow as HTMLElement).getByRole('button', {
        name: 'Deactivate',
      }),
    )

    await waitFor(() => {
      expect(screen.getByText(/Inactive/i)).toBeInTheDocument()
    })
    expect(
      within(screen.getByText('Vegan').closest('li') as HTMLElement).getByRole(
        'button',
        { name: 'Reactivate' },
      ),
    ).toBeInTheDocument()
  })
})
