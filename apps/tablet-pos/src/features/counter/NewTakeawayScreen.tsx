import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../lib/api-client'
import { ROLE_ROUTES } from '../../lib/device-type'
import { createTakeawayOrder } from '../../lib/orders-api'
import { listZones, type Zone } from '../../lib/zones-api'

/** Counter ops: create a draft TAKEAWAY order (zone + customer name). */
export function NewTakeawayScreen() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

  const activeZones = useMemo(
    () =>
      [...zones]
        .filter((zone) => zone.is_active)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        ),
    [zones],
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        setZones(await listZones())
      } catch (err) {
        if (err instanceof HubApiError || err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to load zones')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setCreatedOrderId(null)
    try {
      const order = await createTakeawayOrder({
        zone_id: zoneId,
        customer_name: customerName,
      })
      setCreatedOrderId(order.id)
      setCustomerName('')
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Create failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to={ROLE_ROUTES.COUNTER}>Counter</Link>
            {' / '}
            Orders
          </p>
          <h1>New takeaway</h1>
        </div>
      </header>

      {loading ? (
        <section className="card">
          <p className="muted">Loading zones…</p>
        </section>
      ) : (
        <form className="card pairing-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Zone</span>
            <select
              aria-label="Zone"
              value={zoneId}
              onChange={(event) => setZoneId(event.target.value)}
              required
            >
              <option value="" disabled>
                Select a zone
              </option>
              {activeZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Customer name</span>
            <input
              aria-label="Customer name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              autoComplete="name"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {createdOrderId ? (
            <p role="status">
              Order created: <strong>{createdOrderId}</strong>
            </p>
          ) : null}

          <div className="button-row">
            <button type="submit" disabled={submitting || !zoneId}>
              {submitting ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
