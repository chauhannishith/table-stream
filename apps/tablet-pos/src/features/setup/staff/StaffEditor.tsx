import { useState, type FormEvent } from 'react'
import type { StaffRole } from '@table-stream/shared-types/domain'
import { HubApiError } from '../../../lib/api-client'
import { STAFF_ROLES, validateStaffPin } from '../../../lib/staff-api'

export type StaffEditorProps = {
  title: string
  initialName: string
  initialRole: StaffRole
  /** When true, PIN is required (create). When false, blank PIN keeps existing. */
  requirePin: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    name: string
    role: StaffRole
    pin?: string
  }) => Promise<void>
}

/** Create/edit form for staff name, role, and PIN (never displays pin_hash). */
export function StaffEditor({
  title,
  initialName,
  initialRole,
  requirePin,
  submitLabel,
  onCancel,
  onSubmit,
}: StaffEditorProps) {
  const [name, setName] = useState(initialName)
  const [role, setRole] = useState<StaffRole>(initialRole)
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const trimmedPin = pin.trim()
      if (requirePin || trimmedPin) {
        validateStaffPin(trimmedPin)
      }
      await onSubmit({
        name,
        role,
        ...(trimmedPin ? { pin: trimmedPin } : {}),
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

  const canSubmit =
    name.trim().length > 0 && (!requirePin || pin.trim().length > 0)

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

      <label className="field">
        <span>Role</span>
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          required
        >
          {STAFF_ROLES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{requirePin ? 'PIN' : 'New PIN (optional)'}</span>
        <input
          aria-label={requirePin ? 'PIN' : 'New PIN'}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required={requirePin}
          placeholder={requirePin ? '4–8 digits' : 'Leave blank to keep'}
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
