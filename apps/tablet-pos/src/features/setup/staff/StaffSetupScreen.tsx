import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  createStaff,
  listStaff,
  updateStaff,
  type Staff,
} from '../../../lib/staff-api'
import { StaffEditor } from './StaffEditor'

/** Counter setup: list / create / edit role / deactivate staff (no pin_hash). */
export function StaffSetupScreen() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<
    | { kind: 'list' }
    | { kind: 'create' }
    | { kind: 'edit'; member: Staff }
  >({ kind: 'list' })

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setStaff(await listStaff())
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load staff')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function setActive(member: Staff, is_active: boolean) {
    setError(null)
    try {
      await updateStaff(member.id, { is_active })
      await reload()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Update failed')
      }
    }
  }

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to={ROLE_ROUTES.COUNTER}>Counter</Link>
            {' / '}
            Setup
          </p>
          <h1>Staff</h1>
        </div>
        {mode.kind === 'list' ? (
          <button type="button" onClick={() => setMode({ kind: 'create' })}>
            New staff
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <StaffEditor
          title="Create staff"
          initialName=""
          initialRole="WAITER"
          requirePin
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            if (!input.pin) {
              throw new Error('PIN is required')
            }
            await createStaff({
              name: input.name,
              role: input.role,
              pin: input.pin,
            })
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <StaffEditor
          title={`Edit ${mode.member.name}`}
          initialName={mode.member.name}
          initialRole={mode.member.role}
          requirePin={false}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updateStaff(mode.member.id, {
              name: input.name,
              role: input.role,
              ...(input.pin ? { pin: input.pin } : {}),
            })
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <section className="card">
          {loading ? <p className="muted">Loading staff…</p> : null}
          {!loading && staff.length === 0 ? (
            <p className="muted">No staff yet. Create one to get started.</p>
          ) : null}
          <ul className="setup-list">
            {staff.map((member) => (
              <li key={member.id} className="setup-list-item">
                <div>
                  <strong>{member.name}</strong>
                  <p className="muted">
                    {member.is_active ? 'Active' : 'Inactive'}
                    {' · '}
                    {member.role}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setMode({ kind: 'edit', member })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void setActive(member, !member.is_active)}
                  >
                    {member.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
