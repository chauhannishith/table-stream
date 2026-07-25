import { useState, type FormEvent } from 'react'
import { HubApiError } from '../../../lib/api-client'
import {
  centsToPriceString,
  priceStringToCents,
} from '../../../lib/menu-api'

export type ModifierOptionEditorProps = {
  title: string
  initialCode: string
  initialLabel: string
  initialPriceCents: number
  initialIsDefault: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    code: string
    label: string
    price_cents: number
    is_default: boolean
  }) => Promise<void>
}

/** Parse a price-extra string; blank means +0.00. */
export function priceExtraToCents(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  return priceStringToCents(trimmed)
}

/** Create/edit form for a modifier option with live price-extra preview. */
export function ModifierOptionEditor({
  title,
  initialCode,
  initialLabel,
  initialPriceCents,
  initialIsDefault,
  submitLabel,
  onCancel,
  onSubmit,
}: ModifierOptionEditorProps) {
  const [code, setCode] = useState(initialCode)
  const [label, setLabel] = useState(initialLabel)
  const [price, setPrice] = useState(() =>
    centsToPriceString(initialPriceCents),
  )
  const [isDefault, setIsDefault] = useState(initialIsDefault)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  let previewLabel = '+0.00'
  try {
    previewLabel = `+${centsToPriceString(priceExtraToCents(price))}`
  } catch {
    previewLabel = 'Invalid price'
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        code,
        label,
        price_cents: priceExtraToCents(price),
        is_default: isDefault,
      })
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

  const canSubmit = code.trim().length > 0 && label.trim().length > 0

  return (
    <form className="card pairing-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <label className="field">
        <span>Code</span>
        <input
          aria-label="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="cheese"
          required
          autoFocus
        />
      </label>

      <label className="field">
        <span>Label</span>
        <input
          aria-label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Extra cheese"
          required
        />
      </label>

      <label className="field">
        <span>Price extra</span>
        <input
          aria-label="Price extra"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="1.50"
        />
        <p className="muted" aria-live="polite">
          Preview: {previewLabel}
        </p>
      </label>

      <label className="field checkbox-field">
        <input
          type="checkbox"
          aria-label="Default option"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        <span>Default option</span>
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
