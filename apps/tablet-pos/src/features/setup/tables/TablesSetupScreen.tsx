import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  createTable,
  listTables,
  updateTable,
  type FloorTable,
} from '../../../lib/tables-api'
import { listZones, type Zone } from '../../../lib/zones-api'
import type { SetupMode } from '../setup-mode'
import { TableEditor } from './TableEditor'

/** Counter setup: list tables by zone; create/edit label, capacity, and pos. */
export function TablesSetupScreen() {
  const [zones, setZones] = useState<Zone[]>([])
  const [tables, setTables] = useState<FloorTable[]>([])
  const [zoneFilter, setZoneFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<SetupMode<FloorTable>>({ kind: 'list' })

  const activeZones = useMemo(
    () =>
      [...zones]
        .filter((zone) => zone.is_active)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        ),
    [zones],
  )

  const zoneNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const zone of zones) {
      map.set(zone.id, zone.name)
    }
    return map
  }, [zones])

  const visibleTables = useMemo(() => {
    if (!zoneFilter) return tables
    return tables.filter((table) => table.zone_id === zoneFilter)
  }, [tables, zoneFilter])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [nextZones, nextTables] = await Promise.all([
        listZones(),
        listTables(),
      ])
      setZones(nextZones)
      setTables(nextTables)
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load tables')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const defaultZoneId = zoneFilter || activeZones[0]?.id || ''

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to={ROLE_ROUTES.COUNTER}>Counter</Link>
            {' / '}
            Setup
          </p>
          <h1>Tables</h1>
        </div>
        {mode.kind === 'list' ? (
          <button
            type="button"
            disabled={activeZones.length === 0}
            onClick={() => setMode({ kind: 'create' })}
          >
            New table
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <TableEditor
          title="Create table"
          zones={activeZones}
          initialZoneId={defaultZoneId}
          initialLabel=""
          initialCapacity="2"
          initialPosX=""
          initialPosY=""
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await createTable(input)
            setMode({ kind: 'list' })
            setZoneFilter(input.zone_id)
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <TableEditor
          title={`Edit ${mode.entity.label}`}
          zones={activeZones}
          initialZoneId={mode.entity.zone_id}
          initialLabel={mode.entity.label}
          initialCapacity={String(mode.entity.capacity)}
          initialPosX={
            mode.entity.pos_x === null ? '' : String(mode.entity.pos_x)
          }
          initialPosY={
            mode.entity.pos_y === null ? '' : String(mode.entity.pos_y)
          }
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updateTable(mode.entity.id, input)
            setMode({ kind: 'list' })
            setZoneFilter(input.zone_id)
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <section className="card">
          <label className="field">
            <span>Filter by zone</span>
            <select
              aria-label="Filter by zone"
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
            >
              <option value="">All zones</option>
              {activeZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>

          {loading ? <p className="muted">Loading tables…</p> : null}
          {!loading && activeZones.length === 0 ? (
            <p className="muted">
              No active zones yet. Create a zone before adding tables.
            </p>
          ) : null}
          {!loading &&
          activeZones.length > 0 &&
          visibleTables.length === 0 ? (
            <p className="muted">No tables yet. Create one to get started.</p>
          ) : null}

          <ul className="setup-list">
            {visibleTables.map((table) => (
              <li key={table.id} className="setup-list-item">
                <div>
                  <strong>{table.label}</strong>
                  <p className="muted">
                    {zoneNameById.get(table.zone_id) ?? table.zone_id}
                    {' · '}
                    seats {table.capacity}
                    {table.pos_x !== null || table.pos_y !== null
                      ? ` · (${table.pos_x ?? '—'}, ${table.pos_y ?? '—'})`
                      : ''}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setMode({ kind: 'edit', entity: table })}
                  >
                    Edit
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
