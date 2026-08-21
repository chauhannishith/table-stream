import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../src/AppRoutes'
import { counterOrderDetailPath } from '../src/lib/device-type'
import { createCategory, createMenuItem } from '../src/lib/menu-api'
import { createTakeawayOrder } from '../src/lib/orders-api'
import { setMenuItemZonePrices } from '../src/lib/zone-prices-api'
import { createZone } from '../src/lib/zones-api'
import { createTestRender } from './create-test-render'

describe('CounterOrderScreen (MSW)', () => {
  async function seedTakeawayOrder() {
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
    return { order, item }
  }

  it('adds a line with quantity and shows snapped zone price', async () => {
    const { order } = await seedTakeawayOrder()

    const { user } = createTestRender(<AppRoutes />, {
      route: counterOrderDetailPath(order.id),
    })

    expect(await screen.findByText('Burger')).toBeInTheDocument()
    expect(screen.getByText('6.50')).toBeInTheDocument()

    const menuQtyInputs = screen.getAllByLabelText('Quantity for Burger')
    const menuQtyInput = menuQtyInputs[0]
    expect(menuQtyInput).toBeDefined()
    await user.clear(menuQtyInput!)
    await user.type(menuQtyInput!, '2')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('6.50 each')).toBeInTheDocument()
    expect(screen.getByText('13.00')).toBeInTheDocument()
    expect(screen.getByText(/Subtotal:\s*13.00/)).toBeInTheDocument()
  })

  it('updates draft line quantity and recalculates subtotal', async () => {
    const { order } = await seedTakeawayOrder()

    const { user } = createTestRender(<AppRoutes />, {
      route: counterOrderDetailPath(order.id),
    })

    expect(await screen.findByText('Burger')).toBeInTheDocument()

    const menuQtyInputs = screen.getAllByLabelText('Quantity for Burger')
    const menuQtyInput = menuQtyInputs[0]
    expect(menuQtyInput).toBeDefined()
    await user.clear(menuQtyInput!)
    await user.type(menuQtyInput!, '2')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText(/Subtotal:\s*13.00/)).toBeInTheDocument()

    const draftLines = screen.getByRole('heading', { name: 'Draft lines' }).closest('section')
    expect(draftLines).not.toBeNull()
    const lineQtyInput = within(draftLines as HTMLElement).getByLabelText('Quantity for Burger')
    await user.clear(lineQtyInput)
    await user.type(lineQtyInput, '3')
    await user.click(within(draftLines as HTMLElement).getByRole('button', { name: 'Update' }))

    expect(await screen.findByText(/Subtotal:\s*19.50/)).toBeInTheDocument()
    expect(screen.getByText('19.50')).toBeInTheDocument()
  })

  it('removes a draft line and clears subtotal', async () => {
    const { order } = await seedTakeawayOrder()

    const { user } = createTestRender(<AppRoutes />, {
      route: counterOrderDetailPath(order.id),
    })

    expect(await screen.findByText('Burger')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText(/Subtotal:\s*6.50/)).toBeInTheDocument()

    const draftLines = screen.getByRole('heading', { name: 'Draft lines' }).closest('section')
    expect(draftLines).not.toBeNull()
    await user.click(within(draftLines as HTMLElement).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('No lines yet.')).toBeInTheDocument()
    expect(screen.getByText(/Subtotal:\s*0.00/)).toBeInTheDocument()
  })

  it('submits draft lines and displays takeaway token', async () => {
    const { order } = await seedTakeawayOrder()

    const { user } = createTestRender(<AppRoutes />, {
      route: counterOrderDetailPath(order.id),
    })

    expect(await screen.findByText('Burger')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit to kitchen' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/Subtotal:\s*6.50/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit to kitchen' }))

    expect(await screen.findByText(/Token:/)).toBeInTheDocument()
    expect(screen.getByText('T-001')).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit to kitchen' })).toBeDisabled()
  })

  it('previews and locks bill with optional tip', async () => {
    const { order } = await seedTakeawayOrder()

    const { user } = createTestRender(<AppRoutes />, {
      route: counterOrderDetailPath(order.id),
    })

    expect(await screen.findByText('Burger')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('heading', { name: 'Bill' })).toBeInTheDocument()

    const tipInput = screen.getByLabelText('Tip in cents')
    await user.clear(tipInput)
    await user.type(tipInput, '100')
    await user.click(screen.getByRole('button', { name: 'Preview bill' }))

    expect(await screen.findByText(/Tip:\s*1.00/)).toBeInTheDocument()
    expect(screen.getByText(/Total:/)).toBeInTheDocument()
    expect(screen.getByText('7.50')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lock bill' }))

    expect(await screen.findByText(/Status:\s*CHECK_PRINTED/)).toBeInTheDocument()
    expect(screen.getByText(/Total:/)).toBeInTheDocument()
    expect(screen.getByText('7.50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock bill' })).not.toBeInTheDocument()
  })
})
