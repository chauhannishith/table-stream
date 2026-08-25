import { QuantityField } from '../../components/forms/QuantityField'
import { centsToPriceString } from '../../lib/menu-api'
import type { OrderLine } from '../../lib/orders-api'

type OrderLinesCardProps = {
  lines: OrderLine[]
  lineQuantities: Record<string, string>
  updatingLineId: string | null
  removingLineId: string | null
  onQuantityChange: (lineId: string, value: string) => void
  onUpdateLine: (lineId: string, currentQuantity: number) => void
  onRemoveLine: (lineId: string) => void
}

/** Draft vs submitted order lines. */
export function OrderLinesCard({
  lines,
  lineQuantities,
  updatingLineId,
  removingLineId,
  onQuantityChange,
  onUpdateLine,
  onRemoveLine,
}: OrderLinesCardProps) {
  return (
    <section className="card">
      <h2>Draft lines</h2>
      {lines.length === 0 ? (
        <p className="muted">No lines yet.</p>
      ) : (
        <ul className="setup-list">
          {lines.map((line) => (
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
                    onChange={(value) => onQuantityChange(line.id, value)}
                  />
                  <button
                    type="button"
                    disabled={
                      updatingLineId === line.id ||
                      Number(lineQuantities[line.id] ?? String(line.quantity)) < 1
                    }
                    onClick={() => onUpdateLine(line.id, line.quantity)}
                  >
                    {updatingLineId === line.id ? 'Saving…' : 'Update'}
                  </button>
                  <button
                    type="button"
                    disabled={removingLineId === line.id}
                    onClick={() => onRemoveLine(line.id)}
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
  )
}
