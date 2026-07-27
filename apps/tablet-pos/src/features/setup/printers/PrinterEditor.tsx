import { useState, type FormEvent } from 'react'
import type { PrinterRole } from '@table-stream/shared-types/domain'
import { HubApiError } from '../../../lib/api-client'
import { PRINTER_ROLES, parsePrinterRole } from '../../../lib/printers-api'

export type PrinterEditorProps = {
  title: string
  initialName: string
  initialRole: PrinterRole
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    name: string
    role: PrinterRole
  }) => Promise<void>
}

/** Create/edit form for printer name and hub role. */
export function PrinterEditor({
  title,
  initialName,
  initialRole,
  submitLabel,
  onCancel,
  onSubmit,
}: PrinterEditorProps) {
  const [name, setName] = useState(initialName)
  const [role, setRole] = useState<PrinterRole>(initialRole)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name,
        role: parsePrinterRole(role),
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
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
        />
      </label>

      <label className="field">
        <span>Role</span>
        <select
          aria-label="Role"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as PrinterRole)
          }
          required
        >
          {PRINTER_ROLES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
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
