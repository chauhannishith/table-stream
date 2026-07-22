import { afterEach, describe, expect, it } from 'vitest'
import { testHubConfig } from '../test/fixtures.js'
import { createTestHubDb } from '../test/fixtures.js'
import { seedHubFromConfig } from './hub-seed.js'
import { getLocationById } from '../repositories/locations.js'
import {
  isSubscriptionActive,
  resolveEntitlementFromEnv,
  runLicenseCheck,
} from './license-checker.js'

const ENV_KEYS = [
  'HUB_ENTITLED',
  'SUBSCRIPTION_STATUS',
  'SUBSCRIPTION_PERIOD_END',
] as const

function withEnv(
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => void | Promise<void>,
) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof ENV_KEYS)[number], string | undefined>

  for (const key of ENV_KEYS) {
    if (values[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = values[key]
    }
  }

  return Promise.resolve(fn()).finally(() => {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previous[key]
      }
    }
  })
}

describe('license checker', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
  })

  it('resolveEntitlementFromEnv reads subscription env override', async () => {
    await withEnv(
      {
        HUB_ENTITLED: 'true',
        SUBSCRIPTION_STATUS: 'ACTIVE',
        SUBSCRIPTION_PERIOD_END: '2099-01-01T00:00:00.000Z',
      },
      () => {
        expect(resolveEntitlementFromEnv()).toEqual({
          enabled: true,
          subscriptionStatus: 'ACTIVE',
          currentPeriodEnd: '2099-01-01T00:00:00.000Z',
          source: 'env',
        })
      },
    )
  })

  it('isSubscriptionActive returns false after period end', () => {
    const snapshot = resolveEntitlementFromEnv()
    expect(
      isSubscriptionActive(
        {
          ...snapshot,
          enabled: true,
          subscriptionStatus: 'ACTIVE',
          currentPeriodEnd: '2020-01-01T00:00:00.000Z',
          source: 'env',
        },
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false)
  })

  it('runLicenseCheck sets hub_status SUSPENDED when subscription lapsed', async () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    await withEnv(
      {
        HUB_ENTITLED: 'true',
        SUBSCRIPTION_STATUS: 'ACTIVE',
        SUBSCRIPTION_PERIOD_END: '2020-01-01T00:00:00.000Z',
      },
      async () => {
        const result = await runLicenseCheck(db, testHubConfig, {
          now: new Date('2026-01-01T00:00:00.000Z'),
        })

        expect(result.hub_status).toBe('SUSPENDED')
        const location = getLocationById(db, testHubConfig.location_id)
        expect(location?.hubStatus).toBe('SUSPENDED')
        expect(location?.licenseLastCheckedAt).toBeTruthy()
        expect(location?.suspendedAt).toBeTruthy()
      },
    )
  })

  it('runLicenseCheck sets hub_status ACTIVE for valid env entitlement', async () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    await withEnv(
      {
        HUB_ENTITLED: 'true',
        SUBSCRIPTION_STATUS: 'ACTIVE',
        SUBSCRIPTION_PERIOD_END: '2099-01-01T00:00:00.000Z',
      },
      async () => {
        const result = await runLicenseCheck(db, testHubConfig, {
          now: new Date('2026-01-01T00:00:00.000Z'),
        })

        expect(result.hub_status).toBe('ACTIVE')
        const location = getLocationById(db, testHubConfig.location_id)
        expect(location?.hubStatus).toBe('ACTIVE')
        expect(location?.suspendedAt).toBeNull()
      },
    )
  })

  it('runLicenseCheck uses control plane response when env override is absent', async () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    const result = await runLicenseCheck(db, testHubConfig, {
      fetchImpl: async () =>
        ({
          ok: true,
          json: async () => ({
            enabled: false,
            subscription_status: 'SUSPENDED',
            current_period_end: null,
          }),
        }) as Response,
    })

    expect(result.hub_status).toBe('SUSPENDED')
    expect(result.entitlement.source).toBe('control_plane')
  })
})
