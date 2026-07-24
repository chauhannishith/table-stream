import { useState, type FormEvent } from 'react'
import { HubApiError } from '../../../lib/api-client'
import { taxRulesFromRows, taxRulesToRows } from '../../../lib/zones-api'

type TaxRow = { key: string; percent: string }

export type ZoneEditorProps = {
  title: string
  initialName: string
  initialTaxRules: Record<string, number>
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    name: string
    tax_rules: Record<string, number>
  }) => Promise<void>
}

/** Create/edit form for a zone name and flat % tax_rules rows. */
export function ZoneEditor({
  title,
  initialName,
  initialTaxRules,
  submitLabel,
  onCancel,
  onSubmit,
}: ZoneEditorProps) {
  const [name, setName] = useState(initialName)
  const [rows, setRows] = useState<TaxRow[]>(() =>
    taxRulesToRows(initialTaxRules),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const tax_rules = taxRulesFromRows(rows)
      await onSubmit({ name, tax_rules })
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </label>

      <fieldset className="tax-rules-editor">
        <legend>Tax rules (flat %)</legend>
        <p className="muted">Empty map inherits location billing defaults.</p>
        {rows.map((row, index) => (
          <div className="tax-rule-row" key={index}>
            <input
              aria-label={`Tax key ${index + 1}`}
              placeholder="cgst"
              value={row.key}
              onChange={(e) => {
                const next = [...rows]
                const current = next[index]
                if (!current) return
                next[index] = { ...current, key: e.target.value }
                setRows(next)
              }}
            />
            <input
              aria-label={`Tax percent ${index + 1}`}
              inputMode="decimal"
              placeholder="2.5"
              value={row.percent}
              onChange={(e) => {
                const next = [...rows]
                const current = next[index]
                if (!current) return
                next[index] = { ...current, percent: e.target.value }
                setRows(next)
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              disabled={rows.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setRows([...rows, { key: '', percent: '' }])}
        >
          Add rate
        </button>
      </fieldset>

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
