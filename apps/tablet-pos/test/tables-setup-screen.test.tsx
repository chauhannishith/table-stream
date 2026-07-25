import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TablesSetupScreen } from '../src/features/setup/tables/TablesSetupScreen'
import { createZone } from '../src/lib/zones-api'
import { createTestRender } from './create-test-render'
import { server } from './mocks/server'

describe('TablesSetupScreen (MSW)', () => {
  it('creates a table with capacity and position for a zone', async () => {
    const patio = await createZone({ name: 'Patio' })
    const { user } = createTestRender(<TablesSetupScreen />)

    expect(await screen.findByText(/No tables yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New table' }))
    await user.selectOptions(screen.getByLabelText('Zone'), patio.id)
    await user.type(screen.getByLabelText('Label'), 'T1')
    await user.clear(screen.getByLabelText('Capacity'))
    await user.type(screen.getByLabelText('Capacity'), '4')
    await user.type(screen.getByLabelText('Position X'), '10')
    await user.type(screen.getByLabelText('Position Y'), '20')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('T1')).toBeInTheDocument()
    expect(screen.getByText(/seats 4 · \(10, 20\)/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filter by zone'), patio.id)
    expect(screen.getByText('T1')).toBeInTheDocument()
  })

  it('surfaces Zone not found from hub on create', async () => {
    const patio = await createZone({ name: 'Patio' })
    server.use(
      http.post('*/v1/tables', () =>
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

    const { user } = createTestRender(<TablesSetupScreen />)
    await user.click(await screen.findByRole('button', { name: 'New table' }))
    await user.selectOptions(screen.getByLabelText('Zone'), patio.id)
    await user.type(screen.getByLabelText('Label'), 'Ghost')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Zone not found')).toBeInTheDocument()
    // Editor stays open after the hub error (unnamed <form> is not an a11y role).
    expect(
      screen.getByRole('button', { name: 'Create' }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Ghost')).not.toBeInTheDocument()
    })
  })
})
