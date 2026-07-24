import { useEffect, useState } from 'react'
import {
  fetchHubStatus,
  type HubStatus,
} from '../../lib/hub-status'
import { HubStatusSummary } from './HubStatusSummary'
import { SuspendedBanner } from './SuspendedBanner'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: HubStatus }

/** Fetch and show hub status above role routes. */
export function HubStatusBar() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const status = await fetchHubStatus()
        if (!cancelled) setState({ kind: 'ready', status })
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load hub status'
        setState({ kind: 'error', message })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <header className="hub-status-bar hub-status-bar--loading">
        <span className="muted">Loading hub status…</span>
      </header>
    )
  }

  if (state.kind === 'error') {
    return (
      <header className="hub-status-bar hub-status-bar--error">
        <span className="form-error">{state.message}</span>
      </header>
    )
  }

  return (
    <>
      <HubStatusSummary status={state.status} />
      <SuspendedBanner hubStatus={state.status.hub_status} />
    </>
  )
}
