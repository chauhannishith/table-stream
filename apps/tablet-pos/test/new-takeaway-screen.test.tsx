import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NewTakeawayScreen } from '../src/features/counter/NewTakeawayScreen'
import { createZone } from '../src/lib/zones-api'
import { createTestRender } from './create-test-render'
import { server } from './mocks/server'

describe('NewTakeawayScreen (MSW)', () => {
  it('creates a takeaway order and shows the order id', async () => {
    const patio = await createZone({ name: 'Patio' })
    const { user } = createTestRender(<NewTakeawayScreen />)

    await user.selectOptions(
      await screen.findByLabelText('Zone'),
      patio.id,
    )
    await user.type(screen.getByLabelText('Customer name'), 'Alex')
    await user.click(screen.getByRole('button', { name: 'Create order' }))

    expect(
      await screen.findByRole('status'),
    ).toHaveTextContent(/Order created:\s*ord_1/)
  })

  it('surfaces Zone not found from hub on create', async () => {
    const patio = await createZone({ name: 'Patio' })
    server.use(
      http.post('*/v1/orders', () =>
        HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Zone not found',
              details: { zone_id: patio.id },
            },
          },
          { status: 404 },
        ),
      ),
    )

    const { user } = createTestRender(<NewTakeawayScreen />)
    await user.selectOptions(
      await screen.findByLabelText('Zone'),
      patio.id,
    )
    await user.type(screen.getByLabelText('Customer name'), 'Ghost')
    await user.click(screen.getByRole('button', { name: 'Create order' }))

    expect(await screen.findByText('Zone not found')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
