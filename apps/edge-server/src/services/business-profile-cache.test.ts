import { afterEach, describe, expect, it } from 'vitest'
import {
  getBusinessProfileCache,
  isBusinessProfileCacheStale,
  parseBusinessProfilePayload,
  upsertBusinessProfileCache,
} from '../repositories/business-profile.js'
import {
  BUSINESS_PROFILE_CACHE_TTL_MS,
  ensureBusinessProfileCache,
  refreshBusinessProfileCache,
  refreshBusinessProfileFromEntitlement,
  resolveBusinessProfileFromEnv,
} from '../services/business-profile-cache.js'
import { createTestHubDb, testHubConfig } from '../test/fixtures.js'
import { seedHubFromConfig } from '../services/hub-seed.js'
import { runLicenseCheck } from '../services/license-checker.js'

const ENV_KEYS = [
  'HUB_ENTITLED',
  'SUBSCRIPTION_STATUS',
  'SUBSCRIPTION_PERIOD_END',
  'ORG_LEGAL_NAME',
  'ORG_GST_NUMBER',
  'ORG_PHONE',
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

describe('business profile cache', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
  })

  it('parseBusinessProfilePayload reads control plane shape', () => {
    expect(
      parseBusinessProfilePayload({
        legal_name: 'Acme Foods Pvt Ltd',
        trade_name: 'Acme Cafe',
        gst_number: '29ABCDE1234F1Z5',
        address_lines: { city: 'Bengaluru' },
        phone: '+91-9000000000',
        email: 'billing@acme.test',
      }),
    ).toEqual({
      legal_name: 'Acme Foods Pvt Ltd',
      trade_name: 'Acme Cafe',
      gst_number: '29ABCDE1234F1Z5',
      address_lines: { city: 'Bengaluru' },
      phone: '+91-9000000000',
      email: 'billing@acme.test',
    })
  })

  it('isBusinessProfileCacheStale compares expires_at to now', () => {
    expect(isBusinessProfileCacheStale('2099-01-01 00:00:00')).toBe(false)
    expect(isBusinessProfileCacheStale('2020-01-01 00:00:00')).toBe(true)
  })

  it('refreshBusinessProfileCache upserts hub_business_profile_cache', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)
    const now = new Date('2026-07-01T12:00:00.000Z')

    refreshBusinessProfileCache(
      db,
      testHubConfig.org_id,
      {
        legal_name: 'Cached Cafe LLP',
        trade_name: 'Cached Cafe',
        gst_number: '29ZZZZZ9999Z9',
        address_lines: { city: 'Mumbai' },
        phone: '+91-9111111111',
        email: 'hello@cached.test',
      },
      now,
    )

    const row = getBusinessProfileCache(db, testHubConfig.org_id)
    expect(row?.legalName).toBe('Cached Cafe LLP')
    expect(row?.tradeName).toBe('Cached Cafe')
    expect(row?.gstNumber).toBe('29ZZZZZ9999Z9')
    expect(JSON.parse(row?.addressLinesJson ?? '{}')).toEqual({ city: 'Mumbai' })
    expect(row?.phone).toBe('+91-9111111111')
    expect(row?.email).toBe('hello@cached.test')
    expect(row?.fetchedAt).toBe('2026-07-01 12:00:00')

    const expectedExpiry = new Date(
      now.getTime() + BUSINESS_PROFILE_CACHE_TTL_MS,
    )
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)
    expect(row?.expiresAt).toBe(expectedExpiry)
  })

  it('runLicenseCheck seeds cache from ORG_* env when ACTIVE', async () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    await withEnv(
      {
        HUB_ENTITLED: 'true',
        SUBSCRIPTION_STATUS: 'ACTIVE',
        SUBSCRIPTION_PERIOD_END: '2099-01-01T00:00:00.000Z',
        ORG_LEGAL_NAME: 'Demo Restaurant Pvt Ltd',
        ORG_GST_NUMBER: '29ABCDE1234F1Z5',
        ORG_PHONE: '+91-9000000000',
      },
      async () => {
        await runLicenseCheck(db, testHubConfig, {
          now: new Date('2026-07-01T12:00:00.000Z'),
        })

        const row = getBusinessProfileCache(db, testHubConfig.org_id)
        expect(row?.legalName).toBe('Demo Restaurant Pvt Ltd')
        expect(row?.gstNumber).toBe('29ABCDE1234F1Z5')
        expect(row?.phone).toBe('+91-9000000000')
      },
    )
  })

  it('runLicenseCheck skips cache refresh when hub is SUSPENDED', async () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    await withEnv(
      {
        HUB_ENTITLED: 'false',
        ORG_LEGAL_NAME: 'Should Not Cache',
      },
      async () => {
        await runLicenseCheck(db, testHubConfig)

        expect(getBusinessProfileCache(db, testHubConfig.org_id)).toBeUndefined()
      },
    )
  })

  it('refreshBusinessProfileFromEntitlement uses control plane business_profile', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    refreshBusinessProfileFromEntitlement(
      db,
      testHubConfig,
      true,
      {
        enabled: true,
        subscriptionStatus: 'ACTIVE',
        currentPeriodEnd: '2099-01-01T00:00:00.000Z',
        source: 'control_plane',
        businessProfile: {
          legal_name: 'Cloud Kitchen Pvt Ltd',
          trade_name: null,
          gst_number: '29CLOUD1234F1Z5',
          address_lines: {},
          phone: '+91-8000000000',
          email: null,
        },
      },
      new Date('2026-07-01T12:00:00.000Z'),
    )

    const row = getBusinessProfileCache(db, testHubConfig.org_id)
    expect(row?.legalName).toBe('Cloud Kitchen Pvt Ltd')
    expect(row?.gstNumber).toBe('29CLOUD1234F1Z5')
  })

  it('ensureBusinessProfileCache refreshes stale cache from control plane', async () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)

    upsertBusinessProfileCache(db, {
      orgId: testHubConfig.org_id,
      legalName: 'Stale Name',
      tradeName: null,
      gstNumber: 'OLDGST',
      addressLinesJson: '{}',
      phone: '+91-0000000000',
      email: null,
      logoPath: null,
      fetchedAt: '2020-01-01 00:00:00',
      expiresAt: '2020-01-01 00:00:00',
    })

    await ensureBusinessProfileCache(db, testHubConfig, {
      fetchImpl: async () =>
        ({
          ok: true,
          json: async () => ({
            enabled: true,
            subscription_status: 'ACTIVE',
            current_period_end: '2099-01-01T00:00:00.000Z',
            business_profile: {
              legal_name: 'Fresh From Cloud',
              gst_number: '29FRESH1234F1Z5',
              phone: '+91-7777777777',
            },
          }),
        }) as Response,
      now: new Date('2026-07-01T12:00:00.000Z'),
    })

    const row = getBusinessProfileCache(db, testHubConfig.org_id)
    expect(row?.legalName).toBe('Fresh From Cloud')
    expect(row?.gstNumber).toBe('29FRESH1234F1Z5')
  })

  it('resolveBusinessProfileFromEnv reads ORG_* env vars', async () => {
    await withEnv(
      {
        ORG_LEGAL_NAME: 'Env Cafe',
        ORG_GST_NUMBER: '29ENV1234F1Z5',
        ORG_PHONE: '+91-1234567890',
      },
      () => {
        expect(resolveBusinessProfileFromEnv()).toEqual({
          legal_name: 'Env Cafe',
          trade_name: null,
          gst_number: '29ENV1234F1Z5',
          address_lines: {},
          phone: '+91-1234567890',
          email: null,
        })
      },
    )
  })
})
