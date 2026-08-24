import { QuantityField } from '../../components/forms/QuantityField'
import { centsToPriceString, type MenuItem } from '../../lib/menu-api'

type OrderMenuCardProps = {
  items: MenuItem[]
  quantities: Record<string, string>
  submittingItemId: string | null
  onQuantityChange: (itemId: string, value: string) => void
  onAddItem: (itemId: string) => void
}

/** Zone menu picker for adding draft lines. */
export function OrderMenuCard({
  items,
  quantities,
  submittingItemId,
  onQuantityChange,
  onAddItem,
}: OrderMenuCardProps) {
  return (
    <section className="card">
      <h2>Menu</h2>
      {items.length === 0 ? (
        <p className="muted">No active menu items for this zone yet.</p>
      ) : (
        <ul className="setup-list">
          {items.map((item) => (
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
                  onChange={(value) => onQuantityChange(item.id, value)}
                />
                <button
                  type="button"
                  disabled={
                    submittingItemId === item.id ||
                    Number(quantities[item.id] ?? '1') < 1
                  }
                  onClick={() => onAddItem(item.id)}
                >
                  {submittingItemId === item.id ? 'Adding…' : 'Add'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
