import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BillingSetupScreen } from '../src/features/setup/billing/BillingSetupScreen'
import { createTestRender } from './create-test-render'

describe('BillingSetupScreen (MSW)', () => {
  it('saves and reloads billing settings', async () => {
    const firstRender = createTestRender(<BillingSetupScreen />)
    const { user } = firstRender

    await screen.findByLabelText('Menu prices')
    await user.selectOptions(screen.getByLabelText('Menu prices'), 'INCLUSIVE')
    await user.type(screen.getByLabelText('Tax key 1'), 'gst')
    await user.type(screen.getByLabelText('Tax percent 1'), '18')
    await user.click(screen.getByLabelText('Enabled'))
    await user.type(screen.getByLabelText('Service charge percent'), '5')
    await user.type(screen.getByLabelText('Tip percent 1'), '10')
    await user.click(
      screen.getByRole('button', { name: 'Save billing config' }),
    )

    expect(
      await screen.findByText('Billing config saved.'),
    ).toBeInTheDocument()

    firstRender.unmount()
    createTestRender(<BillingSetupScreen />)

    expect(await screen.findByLabelText('Menu prices')).toHaveValue('INCLUSIVE')
    expect(screen.getByLabelText('Tax key 1')).toHaveValue('gst')
    expect(screen.getByLabelText('Tax percent 1')).toHaveValue('18')
    expect(screen.getByLabelText('Enabled')).toBeChecked()
    expect(screen.getByLabelText('Service charge percent')).toHaveValue('5')
    expect(screen.getByLabelText('Tip percent 1')).toHaveValue('10')
  })

  it('shows flat tax validation errors', async () => {
    const { user } = createTestRender(<BillingSetupScreen />)

    await screen.findByLabelText('Tax key 1')
    await user.type(screen.getByLabelText('Tax key 1'), 'gst')
    await user.type(screen.getByLabelText('Tax percent 1'), '-1')
    await user.click(
      screen.getByRole('button', { name: 'Save billing config' }),
    )

    expect(
      await screen.findByText(
        'tax_rules.gst must be a non-negative number',
      ),
    ).toBeInTheDocument()
  })
})
