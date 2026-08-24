import { Link, useParams } from 'react-router-dom'
import { ROLE_ROUTES } from '../../lib/device-type'
import { OrderBillCard } from '../checkout/OrderBillCard'
import { OrderInvoiceCard } from '../checkout/OrderInvoiceCard'
import { OrderPaymentCard } from '../checkout/OrderPaymentCard'
import { OrderHeaderCard } from './OrderHeaderCard'
import { OrderLinesCard } from './OrderLinesCard'
import { OrderMenuCard } from './OrderMenuCard'
import { useCounterOrder } from './use-counter-order'

/** Counter takeaway order: menu, lines, bill, pay, invoice. */
export function CounterOrderScreen() {
  const { orderId = '' } = useParams()
  const flow = useCounterOrder(orderId)

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

      {flow.loading ? (
        <section className="card">
          <p className="muted">Loading order…</p>
        </section>
      ) : null}

      {!flow.loading && flow.error ? (
        <section className="card">
          <p className="form-error">{flow.error}</p>
        </section>
      ) : null}

      {!flow.loading && flow.order ? (
        <>
          <OrderHeaderCard
            order={flow.order}
            draftLineCount={flow.draftLineCount}
            submittingOrder={flow.submittingOrder}
            onSubmit={() => void flow.handleSubmitOrder()}
          />
          <OrderMenuCard
            items={flow.activeItems}
            quantities={flow.quantities}
            submittingItemId={flow.submittingItemId}
            onQuantityChange={(itemId, value) =>
              flow.setQuantities((current) => ({
                ...current,
                [itemId]: value,
              }))
            }
            onAddItem={(itemId) => void flow.handleAddItem(itemId)}
          />
          <OrderLinesCard
            lines={flow.order.lines}
            lineQuantities={flow.lineQuantities}
            updatingLineId={flow.updatingLineId}
            removingLineId={flow.removingLineId}
            onQuantityChange={(lineId, value) =>
              flow.setLineQuantities((current) => ({
                ...current,
                [lineId]: value,
              }))
            }
            onUpdateLine={(lineId, qty) =>
              void flow.handleUpdateLine(lineId, qty)
            }
            onRemoveLine={(lineId) => void flow.handleRemoveLine(lineId)}
          />
          <OrderBillCard
            order={flow.order}
            billLocked={flow.billLocked}
            discountType={flow.discountType}
            discountValue={flow.discountValue}
            tipCents={flow.tipCents}
            billPreview={flow.billPreview}
            previewingBill={flow.previewingBill}
            lockingBill={flow.lockingBill}
            onDiscountTypeChange={(value) => {
              flow.setDiscountType(value)
              flow.setDiscountValue('')
              flow.setBillPreview(null)
            }}
            onDiscountValueChange={(value) => {
              flow.setDiscountValue(value)
              flow.setBillPreview(null)
            }}
            onTipChange={(value) => {
              flow.setTipCents(value)
              flow.setBillPreview(null)
            }}
            onPreview={() => void flow.handlePreviewBill()}
            onLock={() => void flow.handleLockBill()}
          />
          <OrderPaymentCard
            order={flow.order}
            tenderType={flow.tenderType}
            recordingPayment={flow.recordingPayment}
            onTenderChange={flow.setTenderType}
            onRecordPayment={() => void flow.handleRecordPayment()}
          />
          <OrderInvoiceCard
            order={flow.order}
            invoice={flow.invoice}
            issuingInvoice={flow.issuingInvoice}
            reprintingInvoice={flow.reprintingInvoice}
            onIssue={() => void flow.handleIssueInvoice()}
            onReprint={() => void flow.handleReprintInvoice()}
          />
        </>
      ) : null}
    </main>
  )
}
