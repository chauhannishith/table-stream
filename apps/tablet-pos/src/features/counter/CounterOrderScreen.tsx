import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HubApiError } from '../../lib/api-client'
import { ROLE_ROUTES } from '../../lib/device-type'
import { getOrder, type Order } from '../../lib/orders-api'

/** Counter ops: load one draft order before menu selection. */
export function CounterOrderScreen() {
  const { orderId = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        setOrder(await getOrder(orderId))
      } catch (err) {
        if (err instanceof HubApiError || err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to load order')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [orderId])

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to={ROLE_ROUTES.COUNTER}>Counter</Link>
            {' / '}
            Orders
          </p>
          <h1>Takeaway order</h1>
        </div>
      </header>

      {loading ? (
        <section className="card">
          <p className="muted">Loading order…</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="card">
          <p className="form-error">{error}</p>
        </section>
      ) : null}

      {!loading && order ? (
        <section className="card">
          <h2>{order.customer_name || 'Draft takeaway'}</h2>
          <p className="muted">Order ID: {order.id}</p>
          <p className="muted">Zone: {order.zone_id || 'Unassigned'}</p>
        </section>
      ) : null}
    </main>
  )
}
