import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HubApiError } from '../../lib/api-client'
import { centsToPriceString, type MenuItem } from '../../lib/menu-api'
import { ROLE_ROUTES } from '../../lib/device-type'
import {
  addOrderLine,
  finalizeOrderBill,
  getOrder,
  previewOrderBill,
  removeOrderLine,
  submitOrder,
  updateOrderLine,
  type BillPreview,
  type Order,
} from '../../lib/orders-api'
import { listMenuItemsForZone } from '../../lib/zone-prices-api'

/** Counter ops: load one draft order before menu selection. */
export function CounterOrderScreen() {
  const { orderId = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null)
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null)
  const [removingLineId, setRemovingLineId] = useState<string | null>(null)
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [previewingBill, setPreviewingBill] = useState(false)
  const [lockingBill, setLockingBill] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({})
  const [discountType, setDiscountType] = useState<'' | 'PERCENT' | 'FIXED'>('')
  const [discountValue, setDiscountValue] = useState('')
  const [tipCents, setTipCents] = useState('')
  const [billPreview, setBillPreview] = useState<BillPreview | null>(null)

  const activeItems = useMemo(
    () => items.filter((item) => item.is_active),
    [items],
  )
  const draftLineCount = useMemo(
    () => order?.lines.filter((line) => !line.is_submitted).length ?? 0,
    [order?.lines],
  )
  const billLocked =
    order?.status === 'CHECK_PRINTED' ||
    order?.status === 'PAID' ||
    order?.status === 'VOID'

  function buildBillInput() {
    const input: {
      discount_type?: 'PERCENT' | 'FIXED'
      discount_value?: number
      tip_cents?: number
    } = {}
    if (discountType) {
      const value = Number(discountValue)
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Discount value must be zero or greater')
      }
      input.discount_type = discountType
      input.discount_value = value
    }
    if (tipCents !== '') {
      const tip = Number(tipCents)
      if (!Number.isInteger(tip) || tip < 0) {
        throw new Error('Tip must be a whole number of cents')
      }
      input.tip_cents = tip
    }
    return input
  }

  async function loadOrderAndMenu() {
    setLoading(true)
    setError(null)
    try {
      const loadedOrder = await getOrder(orderId)
      setOrder(loadedOrder)
      if (!loadedOrder.zone_id) {
        setItems([])
        return
      }

      setItems(await listMenuItemsForZone(loadedOrder.zone_id))
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

  useEffect(() => {
    void loadOrderAndMenu()
  }, [orderId])

  useEffect(() => {
    if (!order) {
      setLineQuantities({})
      return
    }
    setLineQuantities(
      Object.fromEntries(order.lines.map((line) => [line.id, String(line.quantity)])),
    )
  }, [order?.id, order?.lines])

  async function handleAddItem(menuItemId: string) {
    const quantity = Number(quantities[menuItemId] ?? '1')
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be at least 1')
      return
    }
    setSubmittingItemId(menuItemId)
    setError(null)
    try {
      await addOrderLine(orderId, {
        menu_item_id: menuItemId,
        quantity,
      })
      setQuantities((current) => ({
        ...current,
        [menuItemId]: '1',
      }))
      await loadOrderAndMenu()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to add item')
      }
    } finally {
      setSubmittingItemId(null)
    }
  }

  async function handleUpdateLine(lineId: string, currentQuantity: number) {
    const quantity = Number(lineQuantities[lineId] ?? String(currentQuantity))
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be at least 1')
      return
    }
    setUpdatingLineId(lineId)
    setError(null)
    try {
      await updateOrderLine(orderId, lineId, { quantity })
      await loadOrderAndMenu()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to update line')
      }
    } finally {
      setUpdatingLineId(null)
    }
  }

  async function handleRemoveLine(lineId: string) {
    setRemovingLineId(lineId)
    setError(null)
    try {
      await removeOrderLine(orderId, lineId)
      await loadOrderAndMenu()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to remove line')
      }
    } finally {
      setRemovingLineId(null)
    }
  }

  async function handleSubmitOrder() {
    setSubmittingOrder(true)
    setError(null)
    try {
      await submitOrder(orderId, {
        idempotencyKey: crypto.randomUUID(),
      })
      await loadOrderAndMenu()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to submit order')
      }
    } finally {
      setSubmittingOrder(false)
    }
  }

  async function handlePreviewBill() {
    setPreviewingBill(true)
    setError(null)
    try {
      const preview = await previewOrderBill(orderId, buildBillInput())
      setBillPreview(preview)
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to preview bill')
      }
    } finally {
      setPreviewingBill(false)
    }
  }

  async function handleLockBill() {
    setLockingBill(true)
    setError(null)
    try {
      await finalizeOrderBill(orderId, buildBillInput())
      setBillPreview(null)
      await loadOrderAndMenu()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to lock bill')
      }
    } finally {
      setLockingBill(false)
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
        <>
          <section className="card">
            <h2>{order.customer_name || 'Draft takeaway'}</h2>
            <p className="muted">Order ID: {order.id}</p>
            <p className="muted">Zone: {order.zone_id || 'Unassigned'}</p>
            {order.token_number ? (
              <p>
                Token: <strong>{order.token_number}</strong>
              </p>
            ) : null}
            <p className="muted">
              Subtotal: {centsToPriceString(order.subtotal_cents)}
            </p>
            <div className="button-row">
              <button
                type="button"
                disabled={submittingOrder || draftLineCount < 1}
                onClick={() => void handleSubmitOrder()}
              >
                {submittingOrder ? 'Submitting…' : 'Submit to kitchen'}
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Menu</h2>
            {activeItems.length === 0 ? (
              <p className="muted">No active menu items for this zone yet.</p>
            ) : (
              <ul className="setup-list">
                {activeItems.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted">
                        {centsToPriceString(item.unit_price_cents)}
                      </p>
                    </div>
                    <div className="button-row">
                      <label className="field">
                        <span>Qty</span>
                        <input
                          aria-label={`Quantity for ${item.name}`}
                          inputMode="numeric"
                          min="1"
                          value={quantities[item.id] ?? '1'}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [item.id]: event.target.value.replace(/\D/g, ''),
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          submittingItemId === item.id ||
                          Number(quantities[item.id] ?? '1') < 1
                        }
                        onClick={() => void handleAddItem(item.id)}
                      >
                        {submittingItemId === item.id ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Draft lines</h2>
            {order.lines.length === 0 ? (
              <p className="muted">No lines yet.</p>
            ) : (
              <ul className="setup-list">
                {order.lines.map((line) => (
                  <li key={line.id}>
                    <div>
                      <strong>{line.name}</strong>
                      <p className="muted">
                        {centsToPriceString(line.unit_price_cents)} each
                      </p>
                    </div>
                    {line.is_submitted ? (
                      <div>
                        <strong>
                          {line.quantity} × {centsToPriceString(line.line_total_cents)}
                        </strong>
                        <p className="muted">Submitted</p>
                      </div>
                    ) : (
                      <div className="button-row">
                        <label className="field">
                          <span>Qty</span>
                          <input
                            aria-label={`Quantity for ${line.name}`}
                            inputMode="numeric"
                            min="1"
                            value={lineQuantities[line.id] ?? String(line.quantity)}
                            onChange={(event) =>
                              setLineQuantities((current) => ({
                                ...current,
                                [line.id]: event.target.value.replace(/\D/g, ''),
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          disabled={
                            updatingLineId === line.id ||
                            Number(lineQuantities[line.id] ?? String(line.quantity)) < 1
                          }
                          onClick={() => void handleUpdateLine(line.id, line.quantity)}
                        >
                          {updatingLineId === line.id ? 'Saving…' : 'Update'}
                        </button>
                        <button
                          type="button"
                          disabled={removingLineId === line.id}
                          onClick={() => void handleRemoveLine(line.id)}
                        >
                          {removingLineId === line.id ? 'Removing…' : 'Remove'}
                        </button>
                        <strong>{centsToPriceString(line.line_total_cents)}</strong>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.lines.length > 0 ? (
            <section className="card">
              <h2>Bill</h2>
              {billLocked ? (
                <>
                  <p className="muted">Status: {order.status}</p>
                  <p className="muted">
                    Subtotal: {centsToPriceString(order.subtotal_cents)}
                  </p>
                  <p className="muted">
                    Discount: {centsToPriceString(order.discount_cents)}
                  </p>
                  <p className="muted">
                    Tax: {centsToPriceString(order.tax_cents)}
                  </p>
                  <p className="muted">
                    Tip: {centsToPriceString(order.tip_cents)}
                  </p>
                  <p>
                    Total: <strong>{centsToPriceString(order.total_cents)}</strong>
                  </p>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Discount type</span>
                    <select
                      aria-label="Discount type"
                      value={discountType}
                      onChange={(event) => {
                        setDiscountType(
                          event.target.value as '' | 'PERCENT' | 'FIXED',
                        )
                        setBillPreview(null)
                      }}
                    >
                      <option value="">None</option>
                      <option value="PERCENT">Percent</option>
                      <option value="FIXED">Fixed (cents)</option>
                    </select>
                  </label>
                  {discountType ? (
                    <label className="field">
                      <span>
                        {discountType === 'PERCENT'
                          ? 'Discount %'
                          : 'Discount cents'}
                      </span>
                      <input
                        aria-label="Discount value"
                        inputMode="decimal"
                        value={discountValue}
                        onChange={(event) => {
                          setDiscountValue(event.target.value.replace(/[^\d.]/g, ''))
                          setBillPreview(null)
                        }}
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Tip (cents)</span>
                    <input
                      aria-label="Tip in cents"
                      inputMode="numeric"
                      value={tipCents}
                      onChange={(event) => {
                        setTipCents(event.target.value.replace(/\D/g, ''))
                        setBillPreview(null)
                      }}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      type="button"
                      disabled={previewingBill || lockingBill}
                      onClick={() => void handlePreviewBill()}
                    >
                      {previewingBill ? 'Previewing…' : 'Preview bill'}
                    </button>
                    <button
                      type="button"
                      disabled={lockingBill || previewingBill}
                      onClick={() => void handleLockBill()}
                    >
                      {lockingBill ? 'Locking…' : 'Lock bill'}
                    </button>
                  </div>
                  {billPreview ? (
                    <div>
                      <p className="muted">
                        Subtotal: {centsToPriceString(billPreview.subtotal_cents)}
                      </p>
                      <p className="muted">
                        Discount:{' '}
                        {centsToPriceString(billPreview.discount_cents)}
                      </p>
                      <p className="muted">
                        Tax: {centsToPriceString(billPreview.tax_cents)}
                      </p>
                      <p className="muted">
                        Tip: {centsToPriceString(billPreview.tip_cents)}
                      </p>
                      <p>
                        Total:{' '}
                        <strong>
                          {centsToPriceString(billPreview.total_cents)}
                        </strong>
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
