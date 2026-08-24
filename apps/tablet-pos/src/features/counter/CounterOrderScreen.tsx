import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HubApiError, hubErrorMessage } from '../../lib/api-client'
import { centsToPriceString, type MenuItem } from '../../lib/menu-api'
import { ROLE_ROUTES } from '../../lib/device-type'
import {
  addOrderLine,
  finalizeOrderBill,
  getInvoice,
  getOrder,
  issueOrderInvoice,
  previewOrderBill,
  recordOrderPayment,
  removeOrderLine,
  submitOrder,
  updateOrderLine,
  type BillPreview,
  type Invoice,
  type Order,
  type TenderType,
} from '../../lib/orders-api'
import { listMenuItemsForZone } from '../../lib/zone-prices-api'
import { QuantityField } from '../../components/forms/QuantityField'
import { MoneyTotals } from '../../components/money/MoneyTotals'
import { ROLE_ROUTES } from '../../lib/device-type'
import {
  addOrderLine,
  finalizeOrderBill,
  getInvoice,
  getOrder,
  issueOrderInvoice,
  previewOrderBill,
  recordOrderPayment,
  removeOrderLine,
  submitOrder,
  updateOrderLine,
  type BillPreview,
  type Invoice,
  type Order,
  type TenderType,
} from '../../lib/orders-api'
import { listMenuItemsForZone } from '../../lib/zone-prices-api'

/** Counter ops: load one draft order before menu selection. */
export function CounterOrderScreen() {
  const { orderId = '' } = useParams()
  const orderIdRef = useRef(orderId)
  orderIdRef.current = orderId
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null)
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null)
  const [removingLineId, setRemovingLineId] = useState<string | null>(null)
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [previewingBill, setPreviewingBill] = useState(false)
  const [lockingBill, setLockingBill] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [issuingInvoice, setIssuingInvoice] = useState(false)
  const [reprintingInvoice, setReprintingInvoice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({})
  const [discountType, setDiscountType] = useState<'' | 'PERCENT' | 'FIXED'>('')
  const [discountValue, setDiscountValue] = useState('')
  const [tipCents, setTipCents] = useState('')
  const [billPreview, setBillPreview] = useState<BillPreview | null>(null)
  const [tenderType, setTenderType] = useState<TenderType>('CASH')
  const [invoice, setInvoice] = useState<Invoice | null>(null)

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
      if (discountType === 'FIXED') {
        if (!Number.isInteger(value) || value < 0) {
          throw new Error('Fixed discount must be a whole number of cents')
        }
      } else if (!Number.isFinite(value) || value < 0) {
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
      setError(hubErrorMessage(err, 'Failed to load order'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTenderType('CASH')
    setInvoice(null)
    setIssuingInvoice(false)
    setReprintingInvoice(false)
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
      setError(hubErrorMessage(err, 'Failed to add item'))
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
      setError(hubErrorMessage(err, 'Failed to update line'))
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
      setError(hubErrorMessage(err, 'Failed to remove line'))
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
      setError(hubErrorMessage(err, 'Failed to submit order'))
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
      setError(hubErrorMessage(err, 'Failed to preview bill'))
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
      setError(hubErrorMessage(err, 'Failed to lock bill'))
    } finally {
      setLockingBill(false)
    }
  }

  async function handleRecordPayment() {
    setRecordingPayment(true)
    setError(null)
    try {
      await recordOrderPayment(orderId, { tender_type: tenderType })
      await loadOrderAndMenu()
    } catch (err) {
      setError(hubErrorMessage(err, 'Failed to record payment'))
    } finally {
      setRecordingPayment(false)
    }
  }

  async function handleIssueInvoice() {
    const requestOrderId = orderId
    setIssuingInvoice(true)
    setError(null)
    try {
      const issued = await issueOrderInvoice(requestOrderId)
      if (orderIdRef.current !== requestOrderId) {
        return
      }
      setInvoice(issued)
    } catch (err) {
      if (orderIdRef.current !== requestOrderId) {
        return
      }
      if (
        err instanceof HubApiError &&
        err.code === 'CONFLICT' &&
        typeof err.details.invoice_id === 'string'
      ) {
        try {
          const existing = await getInvoice(err.details.invoice_id)
          if (orderIdRef.current !== requestOrderId) {
            return
          }
          setInvoice(existing)
          return
        } catch (reloadErr) {
          if (orderIdRef.current !== requestOrderId) {
            return
          }
          setError(hubErrorMessage(reloadErr, 'Failed to load invoice'))
          return
        }
      }
      setError(hubErrorMessage(err, 'Failed to issue invoice'))
    } finally {
      if (orderIdRef.current === requestOrderId) {
        setIssuingInvoice(false)
      }
    }
  }

  async function handleReprintInvoice() {
    if (!invoice) {
      return
    }
    const requestOrderId = orderId
    const invoiceId = invoice.id
    setReprintingInvoice(true)
    setError(null)
    try {
      const reprinted = await getInvoice(invoiceId)
      if (orderIdRef.current !== requestOrderId) {
        return
      }
      setInvoice(reprinted)
    } catch (err) {
      if (orderIdRef.current !== requestOrderId) {
        return
      }
      setError(hubErrorMessage(err, 'Failed to reprint invoice'))
    } finally {
      if (orderIdRef.current === requestOrderId) {
        setReprintingInvoice(false)
      }
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
                      <QuantityField
                        itemName={item.name}
                        value={quantities[item.id] ?? '1'}
                        onChange={(value) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.id]: value,
                          }))
                        }
                      />
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
                        <QuantityField
                          itemName={line.name}
                          value={lineQuantities[line.id] ?? String(line.quantity)}
                          onChange={(value) =>
                            setLineQuantities((current) => ({
                              ...current,
                              [line.id]: value,
                            }))
                          }
                        />
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
                  <MoneyTotals
                    subtotalCents={order.subtotal_cents}
                    discountCents={order.discount_cents}
                    taxCents={order.tax_cents}
                    tipCents={order.tip_cents}
                    totalCents={order.total_cents}
                  />
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Discount type</span>
                    <select
                      aria-label="Discount type"
                      value={discountType}
                      onChange={(event) => {
                        const nextType = event.target.value as
                          | ''
                          | 'PERCENT'
                          | 'FIXED'
                        setDiscountType(nextType)
                        setDiscountValue('')
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
                        inputMode={discountType === 'FIXED' ? 'numeric' : 'decimal'}
                        value={discountValue}
                        onChange={(event) => {
                          const next =
                            discountType === 'FIXED'
                              ? event.target.value.replace(/\D/g, '')
                              : event.target.value.replace(/[^\d.]/g, '')
                          setDiscountValue(next)
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
                    <MoneyTotals
                      subtotalCents={billPreview.subtotal_cents}
                      discountCents={billPreview.discount_cents}
                      taxCents={billPreview.tax_cents}
                      tipCents={billPreview.tip_cents}
                      totalCents={billPreview.total_cents}
                    />
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {order.status === 'CHECK_PRINTED' || order.status === 'PAID' ? (
            <section className="card">
              <h2>Payment</h2>
              {order.status === 'PAID' ? (
                <p>
                  Paid <strong>{centsToPriceString(order.total_cents)}</strong>
                </p>
              ) : (
                <>
                  <label className="field">
                    <span>Tender</span>
                    <select
                      aria-label="Tender type"
                      value={tenderType}
                      onChange={(event) =>
                        setTenderType(event.target.value as TenderType)
                      }
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <div className="button-row">
                    <button
                      type="button"
                      disabled={recordingPayment}
                      onClick={() => void handleRecordPayment()}
                    >
                      {recordingPayment ? 'Recording…' : 'Record payment'}
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {order.status === 'PAID' ? (
            <section className="card">
              <h2>Invoice</h2>
              {invoice ? (
                <>
                  <p>
                    <strong>{invoice.invoice_number}</strong>
                  </p>
                  {invoice.token_number ? (
                    <p className="muted">Token: {invoice.token_number}</p>
                  ) : null}
                  <p>
                    {invoice.business_snapshot.legal_name ||
                      invoice.business_snapshot.trade_name ||
                      'Business'}
                  </p>
                  {invoice.business_snapshot.gst_number ? (
                    <p className="muted">
                      GST: {invoice.business_snapshot.gst_number}
                    </p>
                  ) : null}
                  {invoice.business_snapshot.phone ? (
                    <p className="muted">{invoice.business_snapshot.phone}</p>
                  ) : null}
                  {invoice.business_snapshot.email ? (
                    <p className="muted">{invoice.business_snapshot.email}</p>
                  ) : null}
                  <MoneyTotals
                    subtotalCents={invoice.subtotal_cents}
                    discountCents={invoice.discount_cents}
                    taxCents={invoice.tax_cents}
                    tipCents={invoice.tip_cents}
                    totalCents={invoice.total_cents}
                    taxBreakdown={invoice.tax_breakdown}
                  />
                  <div className="button-row">
                    <button
                      type="button"
                      disabled={reprintingInvoice}
                      onClick={() => void handleReprintInvoice()}
                    >
                      {reprintingInvoice ? 'Loading…' : 'Reprint'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="button-row">
                  <button
                    type="button"
                    disabled={issuingInvoice}
                    onClick={() => void handleIssueInvoice()}
                  >
                    {issuingInvoice ? 'Issuing…' : 'Issue invoice'}
                  </button>
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
