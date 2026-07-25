import { useState, type FormEvent } from 'react'
import type { PrintStagesConfig } from '@table-stream/shared-types/domain'
import { HubApiError } from '../../../lib/api-client'

export type PrintStagesEditorProps = {
  initialStages: PrintStagesConfig
  onSubmit: (stages: PrintStagesConfig) => Promise<void>
}

/** Edit ordering / kitchen / collection print stage toggles. */
export function PrintStagesEditor({
  initialStages,
  onSubmit,
}: PrintStagesEditorProps) {
  const [stages, setStages] = useState<PrintStagesConfig>(initialStages)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setSaved(false)
    setError(null)
    try {
      await onSubmit(stages)
      setSaved(true)
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
      <h2>Print stages</h2>

      <fieldset className="tax-rules-editor">
        <legend>Ordering</legend>
        <label>
          <input
            type="checkbox"
            aria-label="Ordering enabled"
            checked={stages.ordering.enabled}
            onChange={(event) =>
              setStages({
                ...stages,
                ordering: {
                  ...stages.ordering,
                  enabled: event.target.checked,
                },
              })
            }
          />{' '}
          Enabled
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Auto print on bill"
            checked={stages.ordering.auto_on_bill}
            onChange={(event) =>
              setStages({
                ...stages,
                ordering: {
                  ...stages.ordering,
                  auto_on_bill: event.target.checked,
                },
              })
            }
          />{' '}
          Auto on bill
        </label>
      </fieldset>

      <fieldset className="tax-rules-editor">
        <legend>Kitchen</legend>
        <label>
          <input
            type="checkbox"
            aria-label="Kitchen enabled"
            checked={stages.kitchen.enabled}
            onChange={(event) =>
              setStages({
                ...stages,
                kitchen: {
                  ...stages.kitchen,
                  enabled: event.target.checked,
                },
              })
            }
          />{' '}
          Enabled
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Auto print on submit"
            checked={stages.kitchen.auto_on_submit}
            onChange={(event) =>
              setStages({
                ...stages,
                kitchen: {
                  ...stages.kitchen,
                  auto_on_submit: event.target.checked,
                },
              })
            }
          />{' '}
          Auto on submit
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Split by station"
            checked={stages.kitchen.split_by_station}
            onChange={(event) =>
              setStages({
                ...stages,
                kitchen: {
                  ...stages.kitchen,
                  split_by_station: event.target.checked,
                },
              })
            }
          />{' '}
          Split by station
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Split by token"
            checked={stages.kitchen.split_by_token}
            onChange={(event) =>
              setStages({
                ...stages,
                kitchen: {
                  ...stages.kitchen,
                  split_by_token: event.target.checked,
                },
              })
            }
          />{' '}
          Split by token
        </label>
      </fieldset>

      <fieldset className="tax-rules-editor">
        <legend>Collection</legend>
        <label>
          <input
            type="checkbox"
            aria-label="Collection enabled"
            checked={stages.collection.enabled}
            onChange={(event) =>
              setStages({
                ...stages,
                collection: {
                  ...stages.collection,
                  enabled: event.target.checked,
                },
              })
            }
          />{' '}
          Enabled
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Auto print dine-in"
            checked={stages.collection.auto_print_dine_in}
            onChange={(event) =>
              setStages({
                ...stages,
                collection: {
                  ...stages.collection,
                  auto_print_dine_in: event.target.checked,
                },
              })
            }
          />{' '}
          Auto print dine-in
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Auto print takeaway"
            checked={stages.collection.auto_print_takeaway}
            onChange={(event) =>
              setStages({
                ...stages,
                collection: {
                  ...stages.collection,
                  auto_print_takeaway: event.target.checked,
                },
              })
            }
          />{' '}
          Auto print takeaway
        </label>
        <label className="field">
          <span>Trigger</span>
          <select
            aria-label="Collection trigger"
            value={stages.collection.trigger}
            onChange={(event) =>
              setStages({
                ...stages,
                collection: {
                  ...stages.collection,
                  trigger: event.target.value as PrintStagesConfig['collection']['trigger'],
                },
              })
            }
          >
            <option value="at_counter">At counter</option>
            <option value="packed">Packed</option>
            <option value="manual_only">Manual only</option>
          </select>
        </label>
      </fieldset>

      {error ? <p className="form-error">{error}</p> : null}
      {saved ? <p role="status">Print stages saved.</p> : null}

      <div className="button-row">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save print stages'}
        </button>
      </div>
    </form>
  )
}
