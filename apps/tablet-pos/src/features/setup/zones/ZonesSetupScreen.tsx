import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  createZone,
  listZones,
  updateZone,
  type Zone,
} from '../../../lib/zones-api'
import { ZoneEditor } from './ZoneEditor'

/** Counter setup: list / create / rename / deactivate zones + tax_rules. */
export function ZonesSetupScreen() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<
    | { kind: 'list' }
    | { kind: 'create' }
    | { kind: 'edit'; zone: Zone }
  >({ kind: 'list' })

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setZones(await listZones())
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load zones')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function setActive(zone: Zone, is_active: boolean) {
    setError(null)
    try {
      await updateZone(zone.id, { is_active })
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
          <h1>Zones</h1>
        </div>
        {mode.kind === 'list' ? (
          <button type="button" onClick={() => setMode({ kind: 'create' })}>
            New zone
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <ZoneEditor
          title="Create zone"
          initialName=""
          initialTaxRules={{}}
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await createZone(input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <ZoneEditor
          title={`Edit ${mode.zone.name}`}
          initialName={mode.zone.name}
          initialTaxRules={mode.zone.tax_rules}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updateZone(mode.zone.id, input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <section className="card">
          {loading ? <p className="muted">Loading zones…</p> : null}
          {!loading && zones.length === 0 ? (
            <p className="muted">No zones yet. Create one to get started.</p>
          ) : null}
          <ul className="setup-list">
            {zones.map((zone) => (
              <li key={zone.id} className="setup-list-item">
                <div>
                  <strong>{zone.name}</strong>
                  <p className="muted">
                    {zone.is_active ? 'Active' : 'Inactive'}
                    {' · '}
                    {Object.keys(zone.tax_rules).length === 0
                      ? 'Inherit location tax'
                      : Object.entries(zone.tax_rules)
                          .map(([key, value]) => `${key} ${value}%`)
                          .join(', ')}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setMode({ kind: 'edit', zone })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void setActive(zone, !zone.is_active)}
                  >
                    {zone.is_active ? 'Deactivate' : 'Reactivate'}
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
