import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  createZone,
  listZones,
  taxRulesFromRows,
  taxRulesToRows,
  updateZone,
  type Zone,
} from '../../../lib/zones-api'

type TaxRow = { key: string; percent: string }

type ZoneEditorProps = {
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

function ZoneEditor({
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
