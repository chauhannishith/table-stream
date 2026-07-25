import { describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import {
  getBillingConfig,
  parsePriceTaxMode,
  serviceChargeRulesFromForm,
  tipQuickActionsFromRows,
  tipQuickActionsToRows,
  updateBillingConfig,
} from './billing-api'

const sampleConfig = {
  location_id: 'loc_test',
  tax_rules: { cgst: 2.5, sgst: 2.5 },
  price_tax_mode: 'EXCLUSIVE' as const,
  service_charge_rules: { enabled: true, percent: 5 },
  tip_quick_actions: [10, 15],
  updated_at: '2026-07-25T00:00:00.000Z',
}

describe('billing form helpers', () => {
  it('parses price_tax_mode', () => {
    expect(parsePriceTaxMode('INCLUSIVE')).toBe('INCLUSIVE')
    expect(parsePriceTaxMode('EXCLUSIVE')).toBe('EXCLUSIVE')
    expect(() => parsePriceTaxMode('MIXED')).toThrow(/INCLUSIVE or EXCLUSIVE/)
  })

  it('builds service charge rules', () => {
    expect(serviceChargeRulesFromForm(false, '')).toEqual({ enabled: false })
    expect(serviceChargeRulesFromForm(true, '5')).toEqual({
      enabled: true,
      percent: 5,
    })
    expect(() => serviceChargeRulesFromForm(true, '')).toThrow(
      /percent is required/,
    )
  })

  it('round-trips tip quick action rows', () => {
    expect(tipQuickActionsFromRows([{ percent: '10' }, { percent: ' 15 ' }])).toEqual([
      10, 15,
    ])
    expect(tipQuickActionsFromRows([{ percent: '' }])).toEqual([])
    expect(tipQuickActionsToRows([10, 15])).toEqual([
      { percent: '10' },
      { percent: '15' },
    ])
    expect(tipQuickActionsToRows([])).toEqual([{ percent: '' }])
  })
})

describe('billing config API helpers', () => {
  it('gets and puts location billing-config', async () => {
    const client = {
      get: vi.fn(async () => ({ billing_config: sampleConfig })),
      put: vi.fn(async () => ({
        billing_config: {
          ...sampleConfig,
          price_tax_mode: 'INCLUSIVE',
          tip_quick_actions: [10, 15, 20],
        },
      })),
    } as unknown as HubApiClient

    await expect(getBillingConfig(client)).resolves.toEqual(sampleConfig)
    expect(client.get).toHaveBeenCalledWith('/v1/location/billing-config')

    await expect(
      updateBillingConfig(
        {
          price_tax_mode: 'INCLUSIVE',
          tax_rules: { cgst: 2.5, sgst: 2.5 },
          tip_quick_actions: [10, 15, 20],
        },
        client,
      ),
    ).resolves.toMatchObject({
      price_tax_mode: 'INCLUSIVE',
      tip_quick_actions: [10, 15, 20],
    })
    expect(client.put).toHaveBeenCalledWith('/v1/location/billing-config', {
      body: {
        price_tax_mode: 'INCLUSIVE',
        tax_rules: { cgst: 2.5, sgst: 2.5 },
        tip_quick_actions: [10, 15, 20],
      },
    })
  })

  it('surfaces hub VALIDATION_ERROR for nested tax_rules', async () => {
    const client = {
      put: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'VALIDATION_ERROR',
            message: 'tax_rules.gst must be a non-negative number',
            details: { key: 'gst' },
          },
          400,
        )
      }),
    } as unknown as HubApiClient

    await expect(
      updateBillingConfig(
        {
          // Nested objects are invalid on the hub; cast to exercise error path.
          tax_rules: { gst: { rate_bps: 500 } } as unknown as Record<
            string,
            number
          >,
        },
        client,
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'tax_rules.gst must be a non-negative number',
      status: 400,
    })
  })
})
