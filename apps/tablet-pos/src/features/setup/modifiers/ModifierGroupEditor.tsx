import { useState, type FormEvent } from 'react'
import { HubApiError } from '../../../lib/api-client'

export type ModifierGroupEditorProps = {
  title: string
  initialName: string
  initialMinSelect: number
  initialMaxSelect: number | null
  initialIsRequired: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    name: string
    min_select: number
    max_select: number | null
    is_required: boolean
  }) => Promise<void>
}

/** Parse optional max select; blank means unlimited (null). */
export function parseMaxSelect(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('max select must be a non-negative integer or blank')
  }
  return value
}

/** Parse min select as a non-negative integer. */
export function parseMinSelect(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('min select is required')
  }
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('min select must be a non-negative integer')
  }
  return value
}

/** Create/edit form for an item-scoped modifier group. */
export function ModifierGroupEditor({
  title,
  initialName,
  initialMinSelect,
  initialMaxSelect,
  initialIsRequired,
  submitLabel,
  onCancel,
  onSubmit,
}: ModifierGroupEditorProps) {
  const [name, setName] = useState(initialName)
  const [minSelect, setMinSelect] = useState(String(initialMinSelect))
  const [maxSelect, setMaxSelect] = useState(
    initialMaxSelect === null ? '' : String(initialMaxSelect),
  )
  const [isRequired, setIsRequired] = useState(initialIsRequired)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name,
        min_select: parseMinSelect(minSelect),
        max_select: parseMaxSelect(maxSelect),
        is_required: isRequired,
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

  return (
    <form className="card pairing-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <label className="field">
        <span>Name</span>
        <input
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </label>

      <label className="field">
        <span>Min select</span>
        <input
          aria-label="Min select"
          inputMode="numeric"
          value={minSelect}
          onChange={(e) => setMinSelect(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Max select</span>
        <input
          aria-label="Max select"
          inputMode="numeric"
          value={maxSelect}
          onChange={(e) => setMaxSelect(e.target.value)}
          placeholder="Blank = unlimited"
        />
      </label>

      <label className="field checkbox-field">
        <input
          type="checkbox"
          aria-label="Required"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
        />
        <span>Required</span>
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
