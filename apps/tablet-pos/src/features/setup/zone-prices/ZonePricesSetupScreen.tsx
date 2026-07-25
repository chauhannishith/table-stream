import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  centsToPriceString,
  listMenuItems,
  type MenuItem,
} from '../../../lib/menu-api'
import {
  listMenuItemsForZone,
  overrideCentsFromResolved,
  parseZonePriceCell,
  setMenuItemZonePrices,
} from '../../../lib/zone-prices-api'
import { listZones, type Zone } from '../../../lib/zones-api'

type DraftMap = Record<string, string>

function cellKey(itemId: string, zoneId: string): string {
  return `${itemId}:${zoneId}`
}

/** Counter setup: items × zones price grid with blank cells inheriting base. */
export function ZonePricesSetupScreen() {
  const [zones, setZones] = useState<Zone[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [loading, setLoading] = useState(true)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeZones = useMemo(
    () =>
      [...zones]
        .filter((zone) => zone.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [zones],
  )

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [nextZones, nextItems] = await Promise.all([
        listZones(),
        listMenuItems(),
      ])
      const active = nextZones.filter((zone) => zone.is_active)
      const resolvedByZone = await Promise.all(
        active.map(async (zone) => ({
          zoneId: zone.id,
          items: await listMenuItemsForZone(zone.id),
        })),
      )

      const nextDrafts: DraftMap = {}
      for (const item of nextItems) {
        for (const { zoneId, items: zoneItems } of resolvedByZone) {
          const resolved = zoneItems.find((row) => row.id === item.id)
          const override = resolved
            ? overrideCentsFromResolved(
                item.base_price_cents,
                resolved.unit_price_cents,
              )
            : null
          nextDrafts[cellKey(item.id, zoneId)] =
            override === null ? '' : centsToPriceString(override)
        }
      }

      setZones(nextZones)
      setItems(nextItems)
      setDrafts(nextDrafts)
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load zone prices')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  function setCell(itemId: string, zoneId: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [cellKey(itemId, zoneId)]: value,
    }))
  }

  async function saveItem(item: MenuItem) {
    setSavingItemId(item.id)
    setError(null)
    try {
      const prices = activeZones.map((zone) => {
        const raw = drafts[cellKey(item.id, zone.id)] ?? ''
        const override = parseZonePriceCell(raw)
        return {
          zone_id: zone.id,
          price_cents:
            override === null ? item.base_price_cents : override,
        }
      })
      await setMenuItemZonePrices(item.id, prices)
      await reload()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Save failed')
      }
    } finally {
      setSavingItemId(null)
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
          <h1>Zone prices</h1>
          <p className="muted">
            Blank cells inherit the item base price. Save writes one item row.
          </p>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="card">
        {loading ? <p className="muted">Loading zone prices…</p> : null}
        {!loading && activeZones.length === 0 ? (
          <p className="muted">
            No active zones yet. Create a zone before setting prices.
          </p>
        ) : null}
        {!loading && activeZones.length > 0 && items.length === 0 ? (
          <p className="muted">
            No menu items yet. Create items before setting zone prices.
          </p>
        ) : null}
        {!loading && activeZones.length > 0 && items.length > 0 ? (
          <div className="zone-prices-scroll">
            <table className="zone-prices-grid">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Base</th>
                  {activeZones.map((zone) => (
                    <th key={zone.id} scope="col">
                      {zone.name}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="visually-hidden">Save</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.name}</th>
                    <td className="muted">
                      {centsToPriceString(item.base_price_cents)}
                    </td>
                    {activeZones.map((zone) => {
                      const id = `zone-price-${item.id}-${zone.id}`
                      const baseLabel = centsToPriceString(
                        item.base_price_cents,
                      )
                      return (
                        <td key={zone.id}>
                          <label className="visually-hidden" htmlFor={id}>
                            {item.name} · {zone.name}
                          </label>
                          <input
                            id={id}
                            type="text"
                            inputMode="decimal"
                            placeholder={baseLabel}
                            value={drafts[cellKey(item.id, zone.id)] ?? ''}
                            onChange={(event) =>
                              setCell(item.id, zone.id, event.target.value)
                            }
                          />
                        </td>
                      )
                    })}
                    <td>
                      <button
                        type="button"
                        disabled={savingItemId === item.id}
                        onClick={() => void saveItem(item)}
                      >
                        {savingItemId === item.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  )
}
