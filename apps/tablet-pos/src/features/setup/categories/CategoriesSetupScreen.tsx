import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  createCategory,
  listCategories,
  updateCategory,
  type MenuCategory,
} from '../../../lib/menu-api'
import { CategoryEditor } from './CategoryEditor'

/** Counter setup: list / create / rename / deactivate menu categories. */
export function CategoriesSetupScreen() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<
    | { kind: 'list' }
    | { kind: 'create' }
    | { kind: 'edit'; category: MenuCategory }
  >({ kind: 'list' })

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setCategories(await listCategories())
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load categories')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function setActive(category: MenuCategory, is_active: boolean) {
    setError(null)
    try {
      await updateCategory(category.id, { is_active })
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
          <h1>Categories</h1>
        </div>
        {mode.kind === 'list' ? (
          <button type="button" onClick={() => setMode({ kind: 'create' })}>
            New category
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <CategoryEditor
          title="Create category"
          initialName=""
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await createCategory(input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <CategoryEditor
          title={`Edit ${mode.category.name}`}
          initialName={mode.category.name}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updateCategory(mode.category.id, { name: input.name })
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <section className="card">
          {loading ? <p className="muted">Loading categories…</p> : null}
          {!loading && categories.length === 0 ? (
            <p className="muted">No categories yet. Create one to get started.</p>
          ) : null}
          <ul className="setup-list">
            {categories.map((category) => (
              <li key={category.id} className="setup-list-item">
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">
                    {category.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setMode({ kind: 'edit', category })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void setActive(category, !category.is_active)}
                  >
                    {category.is_active ? 'Deactivate' : 'Reactivate'}
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
