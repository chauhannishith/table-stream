import { useState, type FormEvent } from 'react'
import type { DeviceType } from '@table-stream/shared-types/domain'
import { HubApiError } from '../../lib/api-client'
import { pairAndStoreDevice } from '../../lib/device-pairing'
import { ROLE_ROUTES } from '../../lib/device-type'
import { getEdgeApiUrl } from '../../lib/hub-config'

const DEVICE_TYPE_OPTIONS: Array<{ value: DeviceType; label: string }> = [
  { value: 'COUNTER', label: 'Counter' },
  { value: 'WAITER', label: 'Waiter' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'CUSTOMER', label: 'Customer' },
]

type PairingScreenProps = {
  onPaired: () => void
}

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const [pairingCode, setPairingCode] = useState('')
  const [deviceType, setDeviceType] = useState<DeviceType>('COUNTER')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await pairAndStoreDevice({
        pairingCode,
        deviceType,
        name,
      })
      onPaired()
    } catch (err) {
      if (err instanceof HubApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Pairing failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell pairing-shell">
      <header>
        <h1>Pair this device</h1>
        <p className="muted">Hub: {getEdgeApiUrl()}</p>
      </header>

      <form className="card pairing-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Pairing code</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            value={pairingCode}
            onChange={(e) =>
              setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            required
          />
        </label>

        <label className="field">
          <span>Device role</span>
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as DeviceType)}
          >
            {DEVICE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({ROLE_ROUTES[option.value]})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Device name</span>
          <input
            type="text"
            placeholder="Front counter tablet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" disabled={submitting || pairingCode.length !== 6}>
          {submitting ? 'Pairing…' : 'Pair device'}
        </button>
      </form>
    </main>
  )
}
