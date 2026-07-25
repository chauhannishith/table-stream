import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import { centsToPriceString, listMenuItems, type MenuItem } from '../../../lib/menu-api'
import {
  createItemModifierGroup,
  createModifierOption,
  listItemModifierGroups,
  listModifierOptions,
  updateModifierGroup,
  updateModifierOption,
  type ModifierGroup,
  type ModifierOption,
} from '../../../lib/modifiers-api'
import { ModifierGroupEditor } from './ModifierGroupEditor'
import { ModifierOptionEditor } from './ModifierOptionEditor'

type Mode =
  | { kind: 'browse' }
  | { kind: 'create-group' }
  | { kind: 'edit-group'; group: ModifierGroup }
  | { kind: 'create-option'; group: ModifierGroup }
  | { kind: 'edit-option'; group: ModifierGroup; option: ModifierOption }

/** Counter setup: item-scoped modifier groups and options with price extras. */
export function ModifiersSetupScreen() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [optionsByGroup, setOptionsByGroup] = useState<
    Record<string, ModifierOption[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'browse' })

  async function reloadItems() {
    setLoading(true)
    setError(null)
    try {
      const nextItems = await listMenuItems()
      setItems(nextItems)
      setSelectedItemId((current) => {
        if (current && nextItems.some((item) => item.id === current)) {
          return current
        }
        return nextItems[0]?.id ?? ''
      })
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load menu items')
      }
    } finally {
      setLoading(false)
    }
  }

  async function reloadGroups(menuItemId: string) {
    if (!menuItemId) {
      setGroups([])
      setOptionsByGroup({})
      return
    }
    setError(null)
    try {
      const nextGroups = await listItemModifierGroups(menuItemId)
      setGroups(nextGroups)
      const optionEntries = await Promise.all(
        nextGroups.map(async (group) => {
          const options = await listModifierOptions(group.id)
          return [group.id, options] as const
        }),
      )
      setOptionsByGroup(Object.fromEntries(optionEntries))
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load modifiers')
      }
    }
  }

  useEffect(() => {
    void reloadItems()
  }, [])

  useEffect(() => {
    void reloadGroups(selectedItemId)
  }, [selectedItemId])

  async function setGroupActive(group: ModifierGroup, is_active: boolean) {
    setError(null)
    try {
      await updateModifierGroup(group.id, { is_active })
      await reloadGroups(selectedItemId)
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Update failed')
      }
    }
  }

  async function setOptionActive(option: ModifierOption, is_active: boolean) {
    setError(null)
    try {
      await updateModifierOption(option.id, { is_active })
      await reloadGroups(selectedItemId)
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Update failed')
      }
    }
  }

  const selectedItem = items.find((item) => item.id === selectedItemId)

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to={ROLE_ROUTES.COUNTER}>Counter</Link>
            {' / '}
            Setup
          </p>
          <h1>Modifiers</h1>
        </div>
        {mode.kind === 'browse' && selectedItemId ? (
          <button
            type="button"
            onClick={() => setMode({ kind: 'create-group' })}
          >
            New group
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create-group' ? (
        <ModifierGroupEditor
          title="Create modifier group"
          initialName=""
          initialMinSelect={0}
          initialMaxSelect={null}
          initialIsRequired={false}
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'browse' })}
          onSubmit={async (input) => {
            await createItemModifierGroup({
              menu_item_id: selectedItemId,
              ...input,
            })
            setMode({ kind: 'browse' })
            await reloadGroups(selectedItemId)
          }}
        />
      ) : null}

      {mode.kind === 'edit-group' ? (
        <ModifierGroupEditor
          title={`Edit ${mode.group.name}`}
          initialName={mode.group.name}
          initialMinSelect={mode.group.min_select}
          initialMaxSelect={mode.group.max_select}
          initialIsRequired={mode.group.is_required}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'browse' })}
          onSubmit={async (input) => {
            await updateModifierGroup(mode.group.id, input)
            setMode({ kind: 'browse' })
            await reloadGroups(selectedItemId)
          }}
        />
      ) : null}

      {mode.kind === 'create-option' ? (
        <ModifierOptionEditor
          title={`Add option to ${mode.group.name}`}
          initialCode=""
          initialLabel=""
          initialPriceCents={0}
          initialIsDefault={false}
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'browse' })}
          onSubmit={async (input) => {
            await createModifierOption(mode.group.id, input)
            setMode({ kind: 'browse' })
            await reloadGroups(selectedItemId)
          }}
        />
      ) : null}

      {mode.kind === 'edit-option' ? (
        <ModifierOptionEditor
          title={`Edit ${mode.option.label}`}
          initialCode={mode.option.code}
          initialLabel={mode.option.label}
          initialPriceCents={mode.option.price_cents}
          initialIsDefault={mode.option.is_default}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'browse' })}
          onSubmit={async (input) => {
            await updateModifierOption(mode.option.id, input)
            setMode({ kind: 'browse' })
            await reloadGroups(selectedItemId)
          }}
        />
      ) : null}

      {mode.kind === 'browse' ? (
        <section className="card">
          {loading ? <p className="muted">Loading menu items…</p> : null}
          {!loading && items.length === 0 ? (
            <p className="muted">
              No menu items yet. Create an item before adding modifiers.
            </p>
          ) : null}
          {items.length > 0 ? (
            <label className="field">
              <span>Menu item</span>
              <select
                aria-label="Menu item"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedItem ? (
            <p className="muted">
              Item-scoped groups for {selectedItem.name} (base{' '}
              {centsToPriceString(selectedItem.base_price_cents)})
            </p>
          ) : null}

          {selectedItemId && groups.length === 0 ? (
            <p className="muted">No modifier groups yet for this item.</p>
          ) : null}

          <ul className="setup-list">
            {groups.map((group) => {
              const options = optionsByGroup[group.id] ?? []
              return (
                <li key={group.id} className="setup-list-item modifier-group">
                  <div>
                    <strong>{group.name}</strong>
                    <p className="muted">
                      {group.is_active ? 'Active' : 'Inactive'}
                      {' · '}
                      min {group.min_select}
                      {' · '}
                      max{' '}
                      {group.max_select === null
                        ? 'unlimited'
                        : group.max_select}
                      {group.is_required ? ' · required' : ''}
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setMode({ kind: 'create-option', group })
                      }
                    >
                      Add option
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setMode({ kind: 'edit-group', group })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        void setGroupActive(group, !group.is_active)
                      }
                    >
                      {group.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>

                  {options.length === 0 ? (
                    <p className="muted">No options yet.</p>
                  ) : (
                    <ul className="setup-list modifier-options">
                      {options.map((option) => (
                        <li key={option.id} className="setup-list-item">
                          <div>
                            <strong>{option.label}</strong>
                            <p className="muted">
                              {option.is_active ? 'Active' : 'Inactive'}
                              {' · '}
                              {option.code}
                              {' · '}
                              +{centsToPriceString(option.price_cents)}
                              {option.is_default ? ' · default' : ''}
                            </p>
                          </div>
                          <div className="button-row">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                setMode({
                                  kind: 'edit-option',
                                  group,
                                  option,
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                void setOptionActive(
                                  option,
                                  !option.is_active,
                                )
                              }
                            >
                              {option.is_active
                                ? 'Deactivate'
                                : 'Reactivate'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
