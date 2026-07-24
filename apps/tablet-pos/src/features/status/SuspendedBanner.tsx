import type { HubStatusValue } from '../../lib/hub-status'
import { isHubSuspended } from '../../lib/hub-status'

type SuspendedBannerProps = {
  hubStatus: HubStatusValue
}

/** Read-only notice when the hub subscription gate is SUSPENDED. */
export function SuspendedBanner({ hubStatus }: SuspendedBannerProps) {
  if (!isHubSuspended({ hub_status: hubStatus })) return null

  return (
    <div className="suspended-banner" role="alert">
      Hub is suspended — historical data stays readable; writes are blocked
      until the subscription is active again.
    </div>
  )
}
