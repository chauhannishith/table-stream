import { getCloudSummary } from '../lib/db'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let summary = {
    orgCount: 0,
    activeSubscriptions: 0,
    syncRecordCount: 0,
    dbHealthy: false,
    error: null as string | null,
  }

  try {
    const data = await getCloudSummary()
    summary = { ...data, error: null }
  } catch (error) {
    summary.error =
      error instanceof Error ? error.message : 'Cloud database unavailable'
  }

  return (
    <main>
      <h1>Cloud Dashboard</h1>
      <p className="muted">Global analytics and subscription control plane (PostgreSQL)</p>

      {summary.error ? (
        <section className="card card-warn">
          <h2>Service status</h2>
          <p>Database unavailable: {summary.error}</p>
        </section>
      ) : null}

      <section className="card">
        <h2>Organizations</h2>
        <p>{summary.orgCount} registered</p>
      </section>

      <section className="card">
        <h2>Active subscriptions</h2>
        <p>{summary.activeSubscriptions}</p>
      </section>

      <section className="card">
        <h2>Sync records</h2>
        <p>{summary.syncRecordCount} events in ledger</p>
      </section>
    </main>
  )
}
