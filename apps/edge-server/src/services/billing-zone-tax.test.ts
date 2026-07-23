import { describe, expect, it } from 'vitest'
import {
  loadBillingConfigSnapshot,
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
