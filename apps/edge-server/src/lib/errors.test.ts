import { describe, expect, it } from 'vitest'
import { AppError, toProblemJson, toUnknownProblemJson } from './errors.js'

describe('toProblemJson', () => {
  it('maps AppError to the standard problem shape', () => {
    const err = new AppError('NOT_FOUND', 'Route not found', 404, { path: '/x' })
    expect(toProblemJson(err)).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: { path: '/x' },
      },
    })
  })
})

describe('toUnknownProblemJson', () => {
  it('passes through AppError status codes', () => {
    const result = toUnknownProblemJson(new AppError('FORBIDDEN', 'Nope', 403))
    expect(result.statusCode).toBe(403)
    expect(result.error.code).toBe('FORBIDDEN')
  })

  it('wraps unknown errors as 500', () => {
    const result = toUnknownProblemJson(new Error('boom'))
    expect(result.statusCode).toBe(500)
    expect(result.error.code).toBe('INTERNAL_ERROR')
  })
})
