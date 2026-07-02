import { getCloudSummary } from '../lib/db.js'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const summary = await getCloudSummary()

  return (
    <main>
      <h1>Cloud Dashboard</h1>
      <p className="muted">Global analytics and subscription control plane (PostgreSQL)</p>

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
