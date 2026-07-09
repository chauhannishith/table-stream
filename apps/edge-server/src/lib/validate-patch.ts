import { AppError } from './errors.js'

export function trimOptionalNonEmpty(
  field: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined

  const trimmed = value.trim()
  if (!trimmed) {
    throw new AppError('VALIDATION_ERROR', `${field} must not be empty`, 400)
  }

  return trimmed
}
