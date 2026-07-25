import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { ZonePricesSetupScreen } from '../src/features/setup/zone-prices/ZonePricesSetupScreen'
import { createCategory, createMenuItem } from '../src/lib/menu-api'
import { createZone } from '../src/lib/zones-api'
import { createTestRender } from './create-test-render'

describe('ZonePricesSetupScreen (MSW)', () => {
  it('edits a zone cell and falls back to base when blank', async () => {
    await createZone({ name: 'Patio' })
    const category = await createCategory({ name: 'Mains' })
    await createMenuItem({
      category_id: category.id,
      name: 'Burger',
      base_price_cents: 500,
    })

    const { user } = createTestRender(<ZonePricesSetupScreen />)

    const cell = await screen.findByLabelText('Burger · Patio')
    expect(cell).toHaveAttribute('placeholder', '5.00')
    expect(cell).toHaveValue('')

    await user.type(cell, '6.50')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Burger · Patio')).toHaveValue('6.50')
    })

    const overrideCell = screen.getByLabelText('Burger · Patio')
    await user.clear(overrideCell)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Burger · Patio')).toHaveValue('')
    })
    expect(screen.getByLabelText('Burger · Patio')).toHaveAttribute(
      'placeholder',
      '5.00',
    )
  })
})
