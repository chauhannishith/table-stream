import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  createTag,
  listTags,
  updateTag,
  type MenuTag,
} from '../../../lib/tags-api'
import type { SetupMode } from '../setup-mode'
import { TagEditor } from './TagEditor'

/** Counter setup: list / create / edit / deactivate menu tags. */
export function TagsSetupScreen() {
  const [tags, setTags] = useState<MenuTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<SetupMode<MenuTag>>({ kind: 'list' })

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setTags(await listTags())
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load tags')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function setActive(tag: MenuTag, is_active: boolean) {
    setError(null)
    try {
      await updateTag(tag.id, { is_active })
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
          <h1>Tags</h1>
        </div>
        {mode.kind === 'list' ? (
          <button type="button" onClick={() => setMode({ kind: 'create' })}>
            New tag
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <TagEditor
          title="Create tag"
          initialCode=""
          initialLabel=""
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await createTag(input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <TagEditor
          title={`Edit ${mode.entity.label}`}
          initialCode={mode.entity.code}
          initialLabel={mode.entity.label}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updateTag(mode.entity.id, input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <section className="card">
          {loading ? <p className="muted">Loading tags…</p> : null}
          {!loading && tags.length === 0 ? (
            <p className="muted">No tags yet. Create one to get started.</p>
          ) : null}
          <ul className="setup-list">
            {tags.map((tag) => (
              <li key={tag.id} className="setup-list-item">
                <div>
                  <strong>{tag.label}</strong>
                  <p className="muted">
                    {tag.is_active ? 'Active' : 'Inactive'}
                    {' · '}
                    {tag.code}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setMode({ kind: 'edit', entity: tag })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void setActive(tag, !tag.is_active)}
                  >
                    {tag.is_active ? 'Deactivate' : 'Reactivate'}
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
