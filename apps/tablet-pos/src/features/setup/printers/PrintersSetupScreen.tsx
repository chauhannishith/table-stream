import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PrintStagesConfig } from '@table-stream/shared-types/domain'
import { HubApiError } from '../../../lib/api-client'
import { ROLE_ROUTES } from '../../../lib/device-type'
import {
  DEFAULT_PRINT_STAGES,
  getPrintConfig,
  updatePrintConfig,
} from '../../../lib/print-config-api'
import {
  createPrinter,
  listPrinters,
  updatePrinter,
  type Printer,
} from '../../../lib/printers-api'
import type { SetupMode } from '../setup-mode'
import { PrinterEditor } from './PrinterEditor'
import { PrintStagesEditor } from './PrintStagesEditor'

/** Counter setup: printer list/roles and location print stage toggles. */
export function PrintersSetupScreen() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [stages, setStages] = useState<PrintStagesConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<SetupMode<Printer>>({ kind: 'list' })

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [nextPrinters, printConfig] = await Promise.all([
        listPrinters(),
        getPrintConfig(),
      ])
      setPrinters(nextPrinters)
      setStages(printConfig.print_stages)
    } catch (err) {
      if (err instanceof HubApiError || err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load printers')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function setActive(printer: Printer, is_active: boolean) {
    setError(null)
    try {
      await updatePrinter(printer.id, { is_active })
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
          <h1>Printers</h1>
        </div>
        {mode.kind === 'list' ? (
          <button type="button" onClick={() => setMode({ kind: 'create' })}>
            New printer
          </button>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {mode.kind === 'create' ? (
        <PrinterEditor
          title="Create printer"
          initialName=""
          initialRole="KITCHEN"
          submitLabel="Create"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await createPrinter(input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'edit' ? (
        <PrinterEditor
          title={`Edit ${mode.entity.name}`}
          initialName={mode.entity.name}
          initialRole={mode.entity.role}
          submitLabel="Save"
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            await updatePrinter(mode.entity.id, input)
            setMode({ kind: 'list' })
            await reload()
          }}
        />
      ) : null}

      {mode.kind === 'list' ? (
        <>
          <section className="card">
            {loading ? <p className="muted">Loading printers…</p> : null}
            {!loading && printers.length === 0 ? (
              <p className="muted">
                No printers yet. Create one to get started.
              </p>
            ) : null}
            <ul className="setup-list">
              {printers.map((printer) => (
                <li key={printer.id} className="setup-list-item">
                  <div>
                    <strong>{printer.name}</strong>
                    <p className="muted">
                      {printer.is_active ? 'Active' : 'Inactive'}
                      {' · '}
                      {printer.role}
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setMode({ kind: 'edit', entity: printer })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        void setActive(printer, !printer.is_active)
                      }
                    >
                      {printer.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {!loading ? (
            <PrintStagesEditor
              initialStages={stages ?? DEFAULT_PRINT_STAGES}
              onSubmit={async (nextStages) => {
                const saved = await updatePrintConfig(nextStages)
                setStages(saved.print_stages)
              }}
            />
          ) : null}
        </>
      ) : null}
    </main>
  )
}
