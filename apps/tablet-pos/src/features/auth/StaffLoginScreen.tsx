import { useEffect, useState, type FormEvent } from 'react'
import { HubApiError } from '../../lib/api-client'
import {
  formatStaffLoginError,
  listStaffForLogin,
  loginAndStoreStaff,
  type StaffMember,
} from '../../lib/staff-login'

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

type StaffLoginScreenProps = {
  onLoggedIn: () => void
}

export function StaffLoginScreen({ onLoggedIn }: StaffLoginScreenProps) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStaff() {
      setLoadingStaff(true)
      setError(null)
      try {
        const members = await listStaffForLogin()
        if (cancelled) return
        setStaff(members)
        const first = members[0]
        if (members.length === 1 && first) {
          setStaffId(first.id)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof HubApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to load staff')
        }
      } finally {
        if (!cancelled) setLoadingStaff(false)
      }
    }

    void loadStaff()
    return () => {
      cancelled = true
    }
  }, [])

  function onPinKey(key: (typeof PIN_KEYS)[number]) {
    setError(null)
    if (key === 'clear') {
      setPin('')
      return
    }
    if (key === 'back') {
      setPin((current) => current.slice(0, -1))
      return
    }
    setPin((current) => (current.length >= 6 ? current : `${current}${key}`))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!staffId || pin.length < 4) return

    setSubmitting(true)
    setError(null)
    try {
      await loginAndStoreStaff({ staffId, pin })
      onLoggedIn()
    } catch (err) {
      setError(formatStaffLoginError(err))
      setPin('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell pairing-shell">
      <header>
        <h1>Staff login</h1>
        <p className="muted">Enter your PIN to continue</p>
      </header>

      <form className="card pairing-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Staff</span>
          <select
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value)
              setPin('')
              setError(null)
            }}
            disabled={loadingStaff || staff.length === 0}
            required
          >
            <option value="">
              {loadingStaff ? 'Loading…' : 'Select staff'}
            </option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.role})
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>PIN</span>
          <div className="pin-display" aria-live="polite">
            {pin.length === 0 ? (
              <span className="muted">••••</span>
            ) : (
              '•'.repeat(pin.length)
            )}
          </div>
        </div>

        <div className="pin-pad" role="group" aria-label="PIN pad">
          {PIN_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="pin-key"
              onClick={() => onPinKey(key)}
              disabled={submitting}
            >
              {key === 'clear' ? 'C' : key === 'back' ? '⌫' : key}
            </button>
          ))}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting || !staffId || pin.length < 4}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
