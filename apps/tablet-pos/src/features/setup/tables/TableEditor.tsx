import { useState, type FormEvent } from 'react'
import { HubApiError } from '../../../lib/api-client'
import {
  parseOptionalCoord,
  parseTableCapacity,
} from '../../../lib/tables-api'

export type TableZoneOption = {
  id: string
  name: string
}

export type TableEditorProps = {
  title: string
  zones: TableZoneOption[]
  initialZoneId: string
  initialLabel: string
  initialCapacity: string
  initialPosX: string
  initialPosY: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: {
    zone_id: string
    label: string
    capacity: number
    pos_x: number | null
    pos_y: number | null
  }) => Promise<void>
}

/** Create/edit form for table label, capacity, zone, and map position. */
export function TableEditor({
  title,
  zones,
  initialZoneId,
  initialLabel,
  initialCapacity,
  initialPosX,
  initialPosY,
  submitLabel,
  onCancel,
  onSubmit,
}: TableEditorProps) {
  const [zoneId, setZoneId] = useState(initialZoneId)
  const [label, setLabel] = useState(initialLabel)
  const [capacity, setCapacity] = useState(initialCapacity)
  const [posX, setPosX] = useState(initialPosX)
  const [posY, setPosY] = useState(initialPosY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        zone_id: zoneId,
        label,
        capacity: parseTableCapacity(capacity),
        pos_x: parseOptionalCoord(posX),
        pos_y: parseOptionalCoord(posY),
      })
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

  const canSubmit =
    zoneId.length > 0 && label.trim().length > 0 && capacity.trim().length > 0

  return (
    <form className="card pairing-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>

      <label className="field">
        <span>Zone</span>
        <select
          aria-label="Zone"
          value={zoneId}
          onChange={(event) => setZoneId(event.target.value)}
          required
        >
          <option value="" disabled>
            Select a zone
          </option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Label</span>
        <input
          aria-label="Label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
          autoFocus
        />
      </label>

      <label className="field">
        <span>Capacity</span>
        <input
          aria-label="Capacity"
          inputMode="numeric"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Position X</span>
        <input
          aria-label="Position X"
          inputMode="decimal"
          value={posX}
          onChange={(event) => setPosX(event.target.value)}
          placeholder="optional"
        />
      </label>

      <label className="field">
        <span>Position Y</span>
        <input
          aria-label="Position Y"
          inputMode="decimal"
          value={posY}
          onChange={(event) => setPosY(event.target.value)}
          placeholder="optional"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
