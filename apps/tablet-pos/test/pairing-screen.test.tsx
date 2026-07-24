import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { PairingScreen } from '../src/features/pairing/PairingScreen'
import { getDeviceToken } from '../src/lib/auth-storage'
import { getStoredDeviceType } from '../src/lib/device-type'
import { createTestRender } from './create-test-render'
import { server } from './mocks/server'

describe('PairingScreen (MSW harness example)', () => {
  it('pairs with a valid code and stores the device token', async () => {
    const onPaired = vi.fn()
    const { user } = createTestRender(<PairingScreen onPaired={onPaired} />)

    await user.type(
      screen.getByPlaceholderText('6-digit code'),
      '123456',
    )
    await user.type(
      screen.getByPlaceholderText('Front counter tablet'),
      'Front counter',
    )
    await user.click(screen.getByRole('button', { name: 'Pair device' }))

    await waitFor(() => {
      expect(onPaired).toHaveBeenCalledTimes(1)
    })
    expect(getDeviceToken()).toBe('tok_test')
    expect(getStoredDeviceType()).toBe('COUNTER')
  })

  it('shows hub error when pairing code is invalid', async () => {
    server.use(
      http.post('*/v1/devices/pair', () =>
        HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired pairing code',
              details: {},
            },
          },
          { status: 401 },
        ),
      ),
    )

    const onPaired = vi.fn()
    const { user } = createTestRender(<PairingScreen onPaired={onPaired} />)

    await user.type(screen.getByPlaceholderText('6-digit code'), '000000')
    await user.type(
      screen.getByPlaceholderText('Front counter tablet'),
      'Bad tablet',
    )
    await user.click(screen.getByRole('button', { name: 'Pair device' }))

    expect(
      await screen.findByText('Invalid or expired pairing code'),
    ).toBeInTheDocument()
    expect(onPaired).not.toHaveBeenCalled()
    expect(getDeviceToken()).toBeNull()
  })
})
