import { describe, expect, it } from 'vitest'
import {
  aggregateTaxByCombinedRate,
  buildInvoiceTaxSnapshot,
  loadBillingConfigSnapshot,
  parseInvoiceTaxSnapshot,
  resolveTaxComponentsForZone,
} from './billing.js'
import { createTestHubDb, testHubConfig } from '../test/fixtures.js'
import { seedHubFromConfig } from './hub-seed.js'
import { setBillingConfig, createZoneEntry } from './floor-setup.js'

describe('zone tax resolution (E11.3)', () => {
  it('inherits location tax when zone tax_rules is empty', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)
    const locationId = testHubConfig.location_id

    setBillingConfig(db, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const zone = createZoneEntry(db, locationId, { name: 'Counter' })

    expect(resolveTaxComponentsForZone(db, locationId, zone.id)).toEqual({
      cgst: 2.5,
      sgst: 2.5,
    })
    expect(loadBillingConfigSnapshot(db, locationId, zone.id)).toEqual({
      priceTaxMode: 'EXCLUSIVE',
      taxComponents: { cgst: 2.5, sgst: 2.5 },
    })
  })

  it('uses zone tax_rules when set', () => {
    const db = createTestHubDb()
    seedHubFromConfig(db, testHubConfig)
    const locationId = testHubConfig.location_id

    setBillingConfig(db, locationId, {
      priceTaxMode: 'EXCLUSIVE',
      taxRules: { cgst: 2.5, sgst: 2.5 },
    })

    const outdoor = createZoneEntry(db, locationId, {
      name: 'Outdoor',
      taxRulesJson: JSON.stringify({ gst: 5 }),
    })
    const bar = createZoneEntry(db, locationId, {
      name: 'Bar',
      taxRulesJson: JSON.stringify({ gst: 18 }),
    })

    expect(resolveTaxComponentsForZone(db, locationId, outdoor.id)).toEqual({
      gst: 5,
    })
    expect(resolveTaxComponentsForZone(db, locationId, bar.id)).toEqual({
      gst: 18,
    })
  })
})

describe('invoice tax snapshot (E11.4)', () => {
  it('builds snapshot with combined rate from applied rules', () => {
    expect(
      buildInvoiceTaxSnapshot({ cgst: 25, sgst: 25 }, { cgst: 2.5, sgst: 2.5 }),
    ).toEqual({
      components: { cgst: 25, sgst: 25 },
      applied_tax_rules: { cgst: 2.5, sgst: 2.5 },
      combined_rate_percent: 5,
    })
  })

  it('parses snapshot shape and legacy flat component maps', () => {
    expect(
      parseInvoiceTaxSnapshot({
        components: { gst: 500 },
        applied_tax_rules: { gst: 5 },
        combined_rate_percent: 5,
      }),
    ).toEqual({
      components: { gst: 500 },
      applied_tax_rules: { gst: 5 },
      combined_rate_percent: 5,
    })

    expect(parseInvoiceTaxSnapshot({ cgst: 25, sgst: 25 })).toEqual({
      components: { cgst: 25, sgst: 25 },
      applied_tax_rules: {},
      combined_rate_percent: 0,
    })
  })

  it('aggregates tax cents by combined rate', () => {
    expect(
      aggregateTaxByCombinedRate([
        { tax_cents: 500, combined_rate_percent: 5 },
        { tax_cents: 1800, combined_rate_percent: 18 },
        { tax_cents: 250, combined_rate_percent: 5 },
      ]),
    ).toEqual([
      { combined_rate_percent: 5, tax_cents: 750, invoice_count: 2 },
      { combined_rate_percent: 18, tax_cents: 1800, invoice_count: 1 },
    ])
  })
})
