import { AppError } from './errors.js'

export function isSqliteUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

export function rethrowUniqueAsConflict(
  error: unknown,
  message: string,
  details: Record<string, unknown> = {},
): never {
  if (isSqliteUniqueViolation(error)) {
    throw new AppError('CONFLICT', message, 409, details)
  }
  throw error
}
