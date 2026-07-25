import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { HubApiError } from '../../../lib/api-client'
import {
  getBillingConfig,
  serviceChargeRulesFromForm,
  tipQuickActionsFromRows,
  tipQuickActionsToRows,
  updateBillingConfig,
  type PriceTaxMode,
} from '../../../lib/billing-api'
import { ROLE_ROUTES } from '../../../lib/device-type'
import { taxRulesFromRows, taxRulesToRows } from '../../../lib/zones-api'

type TaxRow = { key: string; percent: string }
type TipRow = { percent: string }

/** Counter setup: location tax mode, tax rates, service charge, and tip actions. */
export function BillingSetupScreen() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priceTaxMode, setPriceTaxMode] =
    useState<PriceTaxMode>('EXCLUSIVE')
  const [taxRows, setTaxRows] = useState<TaxRow[]>([
    { key: '', percent: '' },
  ])
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false)
  const [serviceChargePercent, setServiceChargePercent] = useState('')
  const [tipRows, setTipRows] = useState<TipRow[]>([{ percent: '' }])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const config = await getBillingConfig()
        setPriceTaxMode(config.price_tax_mode)
        setTaxRows(taxRulesToRows(config.tax_rules))
        setServiceChargeEnabled(
          config.service_charge_rules.enabled === true,
        )
        const percent = config.service_charge_rules.percent
        setServiceChargePercent(
          typeof percent === 'number' ? String(percent) : '',
        )
        setTipRows(tipQuickActionsToRows(config.tip_quick_actions))
      } catch (err) {
        if (err instanceof HubApiError || err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to load billing config')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setSaved(false)
    setError(null)
    try {
      await updateBillingConfig({
        price_tax_mode: priceTaxMode,
        tax_rules: taxRulesFromRows(taxRows),
        service_charge_rules: serviceChargeRulesFromForm(
          serviceChargeEnabled,
          serviceChargePercent,
        ),
        tip_quick_actions: tipQuickActionsFromRows(tipRows),
      })
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
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to={ROLE_ROUTES.COUNTER}>Counter</Link>
            {' / '}
            Setup
          </p>
          <h1>Billing</h1>
        </div>
      </header>

      {loading ? (
        <section className="card">
          <p className="muted">Loading billing config…</p>
        </section>
      ) : (
        <form className="card pairing-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Menu prices</span>
            <select
              value={priceTaxMode}
              onChange={(event) =>
                setPriceTaxMode(event.target.value as PriceTaxMode)
              }
            >
              <option value="EXCLUSIVE">Tax exclusive</option>
              <option value="INCLUSIVE">Tax inclusive</option>
            </select>
          </label>

          <fieldset className="tax-rules-editor">
            <legend>Location tax rules (flat %)</legend>
            {taxRows.map((row, index) => (
              <div className="tax-rule-row" key={index}>
                <input
                  aria-label={`Tax key ${index + 1}`}
                  placeholder="cgst"
                  value={row.key}
                  onChange={(event) => {
                    const next = [...taxRows]
                    const current = next[index]
                    if (!current) return
                    next[index] = { ...current, key: event.target.value }
                    setTaxRows(next)
                  }}
                />
                <input
                  aria-label={`Tax percent ${index + 1}`}
                  inputMode="decimal"
                  placeholder="2.5"
                  value={row.percent}
                  onChange={(event) => {
                    const next = [...taxRows]
                    const current = next[index]
                    if (!current) return
                    next[index] = {
                      ...current,
                      percent: event.target.value,
                    }
                    setTaxRows(next)
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={taxRows.length <= 1}
                  onClick={() =>
                    setTaxRows(taxRows.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setTaxRows([...taxRows, { key: '', percent: '' }])
              }
            >
              Add rate
            </button>
          </fieldset>

          <fieldset className="tax-rules-editor">
            <legend>Service charge</legend>
            <label>
              <input
                type="checkbox"
                checked={serviceChargeEnabled}
                onChange={(event) =>
                  setServiceChargeEnabled(event.target.checked)
                }
              />{' '}
              Enabled
            </label>
            <label className="field">
              <span>Service charge percent</span>
              <input
                inputMode="decimal"
                value={serviceChargePercent}
                disabled={!serviceChargeEnabled}
                onChange={(event) =>
                  setServiceChargePercent(event.target.value)
                }
              />
            </label>
          </fieldset>

          <fieldset className="tax-rules-editor">
            <legend>Tip quick actions (%)</legend>
            {tipRows.map((row, index) => (
              <div className="tax-rule-row" key={index}>
                <input
                  aria-label={`Tip percent ${index + 1}`}
                  inputMode="decimal"
                  placeholder="10"
                  value={row.percent}
                  onChange={(event) => {
                    const next = [...tipRows]
                    next[index] = { percent: event.target.value }
                    setTipRows(next)
                  }}
                />
                <span />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={tipRows.length <= 1}
                  onClick={() =>
                    setTipRows(tipRows.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setTipRows([...tipRows, { percent: '' }])}
            >
              Add tip
            </button>
          </fieldset>

          {error ? <p className="form-error">{error}</p> : null}
          {saved ? <p role="status">Billing config saved.</p> : null}

          <div className="button-row">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save billing config'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
