import { useState, type FormEvent } from 'react'
import { HubApiError } from '../../../lib/api-client'

export type TagEditorProps = {
  title: string
  initialCode: string
  initialLabel: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: { code: string; label: string }) => Promise<void>
}

/** Create/edit form for a menu tag code and label. */
export function TagEditor({
  title,
  initialCode,
  initialLabel,
  submitLabel,
  onCancel,
  onSubmit,
}: TagEditorProps) {
  const [code, setCode] = useState(initialCode)
  const [label, setLabel] = useState(initialLabel)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ code, label })
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
          placeholder="vegan"
          required
          autoFocus
        />
        <p className="muted">Stored lowercase; unique per location.</p>
      </label>

      <label className="field">
        <span>Label</span>
        <input
          aria-label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Vegan"
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
