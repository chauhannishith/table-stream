type QuantityFieldProps = {
  itemName: string
  value: string
  onChange: (value: string) => void
}

/** Numeric qty input used on menu add and draft line edit. */
export function QuantityField({
  itemName,
  value,
  onChange,
}: QuantityFieldProps) {
  return (
    <label className="field">
      <span>Qty</span>
      <input
        aria-label={`Quantity for ${itemName}`}
        inputMode="numeric"
        min="1"
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, ''))
        }
      />
    </label>
  )
}
