import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  centsToPriceString,
  createCategory,
  createMenuItem,
  listCategories,
  listMenuItems,
  updateMenuItem,
  type MenuCategory,
  type MenuItem,
} from '../../../lib/menu-api'
import { MenuItemEditor } from './MenuItemEditor'

/** Counter setup: list / create / edit / deactivate menu items by category. */
export function MenuItemsSetupScreen() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<
    | { kind: 'list' }
    | { kind: 'create' }
    | { kind: 'edit'; item: MenuItem }
  >({ kind: 'list' })

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(category.id, category.name)
    }
    return map
  }, [categories])

  const itemsByCategory = useMemo(() => {
    const groups = new Map<string, MenuItem[]>()
    for (const item of items) {
      const list = groups.get(item.category_id) ?? []
      list.push(item)
      groups.set(item.category_id, list)
    }
    return groups
  }, [items])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [nextItems, nextCategories] = await Promise.all([
        listMenuItems(),
        listCategories(),
      ])
      setItems(nextItems)
      setCategories(nextCategories)
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

  useEffect(() => {
    void reload()
  }, [])

  async function setActive(item: MenuItem, is_active: boolean) {
    setError(null)
    try {
      await updateMenuItem(item.id, { is_active })
      await reload()
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Update failed')
      }
    }
  }

  async function resolveCategoryId(input: {
    category_id: string
    new_category_name?: string
  }): Promise<string> {
    if (input.new_category_name) {
      const category = await createCategory({ name: input.new_category_name })
      return category.id
    }
    return input.category_id
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
          <h1>Menu items</h1>
        </div>
        {mode.kind === 'list' ? (
          <button type="button" onClick={() => setMode({ kind: 'create' })}>
            New item
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <MenuItemEditor
          title="Create menu item"
          initialName=""
          initialCategoryId=""
          initialBasePriceCents={0}
          categories={categories}
          allowNewCategory
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            const category_id = await resolveCategoryId(input)
            await createMenuItem({
              category_id,
              name: input.name,
              base_price_cents: input.base_price_cents,
            })
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <MenuItemEditor
          title={`Edit ${mode.item.name}`}
          initialName={mode.item.name}
          initialCategoryId={mode.item.category_id}
          initialBasePriceCents={mode.item.base_price_cents}
          categories={categories}
          allowNewCategory={false}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updateMenuItem(mode.item.id, {
              name: input.name,
              category_id: input.category_id,
              base_price_cents: input.base_price_cents,
            })
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <section className="card">
          {loading ? <p className="muted">Loading menu items…</p> : null}
          {!loading && items.length === 0 ? (
            <p className="muted">No menu items yet. Create one to get started.</p>
          ) : null}
          {[...itemsByCategory.entries()].map(([categoryId, group]) => (
            <div key={categoryId} className="menu-category-group">
              <h2 className="menu-category-heading">
                {categoryNameById.get(categoryId) ?? 'Unknown category'}
              </h2>
              <ul className="setup-list">
                {group.map((item) => (
                  <li key={item.id} className="setup-list-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted">
                        {item.is_active ? 'Active' : 'Inactive'}
                        {' · '}
                        {centsToPriceString(item.base_price_cents)}
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setMode({ kind: 'edit', item })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void setActive(item, !item.is_active)}
                      >
                        {item.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  )
}
