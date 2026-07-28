import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../src/AppRoutes'
import { counterOrderDetailPath } from '../src/lib/device-type'
import { createCategory, createMenuItem } from '../src/lib/menu-api'
import { createTakeawayOrder } from '../src/lib/orders-api'
import { setMenuItemZonePrices } from '../src/lib/zone-prices-api'
import { createZone } from '../src/lib/zones-api'
import { createTestRender } from './create-test-render'

describe('CounterOrderScreen (MSW)', () => {
  it('adds a line with quantity and shows snapped zone price', async () => {
    const zone = await createZone({ name: 'Patio' })
    const category = await createCategory({ name: 'Mains' })
    const item = await createMenuItem({
      category_id: category.id,
      name: 'Burger',
      base_price_cents: 500,
    })
    await setMenuItemZonePrices(item.id, [
      { zone_id: zone.id, price_cents: 650 },
    ])
    const order = await createTakeawayOrder({
      zone_id: zone.id,
      customer_name: 'Alex',
    })

    const { user } = createTestRender(<AppRoutes />, {
      route: counterOrderDetailPath(order.id),
    })

    expect(await screen.findByText('Burger')).toBeInTheDocument()
    expect(screen.getByText('6.50')).toBeInTheDocument()

    const qtyInput = screen.getByLabelText('Quantity for Burger')
    await user.clear(qtyInput)
    await user.type(qtyInput, '2')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText(/2 × Burger/)).toBeInTheDocument()
    expect(screen.getByText('6.50 each')).toBeInTheDocument()
    expect(screen.getByText('13.00')).toBeInTheDocument()
    expect(screen.getByText(/Subtotal:\s*13.00/)).toBeInTheDocument()
  })
})
