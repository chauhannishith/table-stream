import { describe, expect, it } from 'vitest'
import { trimOptionalNonEmpty } from './validate-patch.js'
import { AppError } from './errors.js'

describe('trimOptionalNonEmpty', () => {
  it('returns undefined when the field is omitted', () => {
    expect(trimOptionalNonEmpty('name', undefined)).toBeUndefined()
  })

  it('returns trimmed text when valid', () => {
    expect(trimOptionalNonEmpty('name', '  Pizza  ')).toBe('Pizza')
  })

  it('rejects whitespace-only values', () => {
    expect(() => trimOptionalNonEmpty('name', '   ')).toThrow(AppError)
  })
})
