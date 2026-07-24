import { useState, type FormEvent } from 'react'
import { HubApiError } from '../../../lib/api-client'
import {
  centsToPriceString,
  priceStringToCents,
  type MenuCategory,
} from '../../../lib/menu-api'

export type MenuItemEditorProps = {
  title: string
  initialName: string
  initialCategoryId: string
  initialBasePriceCents: number
  categories: MenuCategory[]
  /** When true, allow typing a new category name if none exist yet. */
  allowNewCategory: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    name: string
    category_id: string
    new_category_name?: string
    base_price_cents: number
  }) => Promise<void>
}

/** Create/edit form for menu item name, category, and base price. */
export function MenuItemEditor({
  title,
  initialName,
  initialCategoryId,
  initialBasePriceCents,
  categories,
  allowNewCategory,
  submitLabel,
  onCancel,
  onSubmit,
}: MenuItemEditorProps) {
  const selectableCategories = categories.filter(
    (category) =>
      category.is_active || category.id === initialCategoryId,
  )
  const needsNewCategory = allowNewCategory && selectableCategories.length === 0

  const [name, setName] = useState(initialName)
  const [categoryId, setCategoryId] = useState(
    initialCategoryId || selectableCategories[0]?.id || '',
  )
  const [newCategoryName, setNewCategoryName] = useState('')
  const [price, setPrice] = useState(() =>
    centsToPriceString(initialBasePriceCents),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const base_price_cents = priceStringToCents(price)
      if (needsNewCategory) {
        const trimmed = newCategoryName.trim()
        if (!trimmed) {
          throw new Error('category name is required')
        }
        await onSubmit({
          name,
          category_id: '',
          new_category_name: trimmed,
          base_price_cents,
        })
      } else {
        if (!categoryId) {
          throw new Error('category is required')
        }
        await onSubmit({
          name,
          category_id: categoryId,
          base_price_cents,
        })
      }
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Save failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    price.trim().length > 0 &&
    (needsNewCategory ? newCategoryName.trim().length > 0 : categoryId.length > 0)

  return (
    <form className="card pairing-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </label>

      {needsNewCategory ? (
        <label className="field">
          <span>Category name</span>
          <input
            aria-label="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Mains"
            required
          />
          <p className="muted">No categories yet — create one with this item.</p>
        </label>
      ) : (
        <label className="field">
          <span>Category</span>
          <select
            aria-label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {selectableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Base price</span>
        <input
          aria-label="Base price"
          inputMode="decimal"
          placeholder="12.50"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
