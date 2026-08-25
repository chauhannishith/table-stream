import { useEffect, useMemo, useRef, useState } from 'react'
import { HubApiError, hubErrorMessage } from '../../lib/api-client'
import type { MenuItem } from '../../lib/menu-api'
import {
  addOrderLine,
  getOrder,
  removeOrderLine,
  submitOrder,
  updateOrderLine,
  type BillPreview,
  type Invoice,
  type Order,
  type TenderType,
} from '../../lib/orders-api'
import {
  finalizeOrderBill,
  getInvoice,
  issueOrderInvoice,
  previewOrderBill,
  recordOrderPayment,
} from '../../lib/order-checkout-api'
import { listMenuItemsForZone } from '../../lib/zone-prices-api'
import {
  buildBillInput,
  type DiscountTypeChoice,
} from '../../lib/bill-input'

/** Load a counter takeaway order and expose line / checkout actions. */
export function useCounterOrder(orderId: string) {
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
  const [discountType, setDiscountType] = useState<DiscountTypeChoice>('')
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
      const preview = await previewOrderBill(
        orderId,
        buildBillInput({ discountType, discountValue, tipCents }),
      )
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
      await finalizeOrderBill(
        orderId,
        buildBillInput({ discountType, discountValue, tipCents }),
      )
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

  return {
    order,
    loading,
    error,
    activeItems,
    draftLineCount,
    billLocked,
    quantities,
    setQuantities,
    lineQuantities,
    setLineQuantities,
    submittingItemId,
    updatingLineId,
    removingLineId,
    submittingOrder,
    previewingBill,
    lockingBill,
    recordingPayment,
    issuingInvoice,
    reprintingInvoice,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    tipCents,
    setTipCents,
    billPreview,
    setBillPreview,
    tenderType,
    setTenderType,
    invoice,
    handleAddItem,
    handleUpdateLine,
    handleRemoveLine,
    handleSubmitOrder,
    handlePreviewBill,
    handleLockBill,
    handleRecordPayment,
    handleIssueInvoice,
    handleReprintInvoice,
  }
}
