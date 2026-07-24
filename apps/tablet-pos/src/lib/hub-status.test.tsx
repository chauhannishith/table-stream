import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { HubApiClient } from './api-client'
import { fetchHubStatus, isHubSuspended, type HubStatus } from './hub-status'
import { HubStatusSummary } from '../features/status/HubStatusSummary'
import { SuspendedBanner } from '../features/status/SuspendedBanner'

function sampleStatus(
  overrides: Partial<HubStatus> = {},
): HubStatus {
  return {
    hub_status: 'ACTIVE',
    location_name: 'Test Location',
    schema_version: '0005_order_bill_tax_snapshot.sql',
    db_ready: true,
    cloud_sync_enabled: false,
    org_id: 'org_1',
    location_id: 'loc_1',
    hub_id: 'hub_1',
    subscription_status: 'ACTIVE',
    ...overrides,
  }
}

describe('hub status helpers', () => {
  it('detects SUSPENDED hub', () => {
    expect(isHubSuspended(sampleStatus())).toBe(false)
    expect(
      isHubSuspended(sampleStatus({ hub_status: 'SUSPENDED' })),
    ).toBe(true)
  })

  it('fetches GET /v1/status without auth headers', async () => {
    const status = sampleStatus()
    const client = {
      get: vi.fn(async () => status),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(fetchHubStatus(client)).resolves.toEqual(status)
    expect(client.get).toHaveBeenCalledWith('/v1/status', {
      deviceToken: null,
      staffToken: null,
    })
  })
})

describe('hub status UI', () => {
  it('renders ACTIVE location and schema', () => {
    const html = renderToStaticMarkup(
      <HubStatusSummary status={sampleStatus()} />,
    )
    expect(html).toContain('Test Location')
    expect(html).toContain('ACTIVE')
    expect(html).toContain('0005_order_bill_tax_snapshot.sql')
    expect(html).toContain('data-hub-status="ACTIVE"')
  })

  it('renders SUSPENDED badge and banner', () => {
    const status = sampleStatus({ hub_status: 'SUSPENDED' })
    const bar = renderToStaticMarkup(<HubStatusSummary status={status} />)
    const banner = renderToStaticMarkup(
      <SuspendedBanner hubStatus={status.hub_status} />,
    )

    expect(bar).toContain('data-hub-status="SUSPENDED"')
    expect(bar).toContain('SUSPENDED')
    expect(banner).toContain('role="alert"')
    expect(banner).toContain('writes are blocked')
  })

  it('hides suspended banner when ACTIVE', () => {
    const html = renderToStaticMarkup(
      <SuspendedBanner hubStatus="ACTIVE" />,
    )
    expect(html).toBe('')
  })
})
