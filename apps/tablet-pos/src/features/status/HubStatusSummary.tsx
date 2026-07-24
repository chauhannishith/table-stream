import type { HubStatus } from '../../lib/hub-status'

type HubStatusSummaryProps = {
  status: HubStatus
}

/** Presentational hub identity strip (location, gate, schema). */
export function HubStatusSummary({ status }: HubStatusSummaryProps) {
  return (
    <header className="hub-status-bar" data-hub-status={status.hub_status}>
      <span className="hub-status-location">{status.location_name}</span>
      <span
        className={`hub-status-badge hub-status-badge--${status.hub_status.toLowerCase()}`}
      >
        {status.hub_status}
      </span>
      <span className="hub-status-schema muted">
        schema {status.schema_version}
      </span>
    </header>
  )
}
