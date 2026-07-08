export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export type ProblemJson = {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}

export function toProblemJson(err: AppError): ProblemJson {
  return {
    error: {
      code: err.code,
      message: err.message,
      details: err.details,
    },
  }
}

export function toUnknownProblemJson(
  err: unknown,
): ProblemJson & { statusCode: number } {
  if (err instanceof AppError) {
    return { ...toProblemJson(err), statusCode: err.statusCode }
  }

  const message = err instanceof Error ? err.message : 'Internal server error'
  return {
    statusCode: 500,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      details: {},
    },
  }
}
