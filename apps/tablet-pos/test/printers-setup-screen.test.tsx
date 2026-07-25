import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PrintersSetupScreen } from '../src/features/setup/printers/PrintersSetupScreen'
import { createTestRender } from './create-test-render'

describe('PrintersSetupScreen (MSW)', () => {
  it('creates a kitchen printer and saves print stages', async () => {
    const { user } = createTestRender(<PrintersSetupScreen />)

    expect(await screen.findByText(/No printers yet/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Ordering enabled')).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'New printer' }))
    await user.type(screen.getByLabelText('Name'), 'Kitchen grill')
    await user.selectOptions(screen.getByLabelText('Role'), 'KITCHEN')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Kitchen grill')).toBeInTheDocument()
    expect(screen.getByText(/Active · KITCHEN/)).toBeInTheDocument()

    await user.click(screen.getByLabelText('Ordering enabled'))
    await user.click(screen.getByLabelText('Auto print on bill'))
    await user.selectOptions(
      screen.getByLabelText('Collection trigger'),
      'manual_only',
    )
    await user.click(screen.getByRole('button', { name: 'Save print stages' }))

    expect(
      await screen.findByText('Print stages saved.'),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText('Ordering enabled')).not.toBeChecked()
    })
    expect(screen.getByLabelText('Auto print on bill')).not.toBeChecked()
    expect(screen.getByLabelText('Collection trigger')).toHaveValue(
      'manual_only',
    )
  })
})
