import { getDeviceToken, getStaffToken } from './auth-storage'
import { getEdgeApiUrl } from './hub-config'

export type HubProblem = {
  code: string
  message: string
  details: Record<string, unknown>
}

export class HubApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: Record<string, unknown>

  constructor(problem: HubProblem, status: number) {
    super(problem.message)
    this.name = 'HubApiError'
    this.code = problem.code
    this.status = status
    this.details = problem.details
  }
}

export type ApiRequestOptions = {
  body?: unknown
  /** Override stored device token; pass null to omit header. */
  deviceToken?: string | null
  /** Override stored staff token; pass null to omit header. */
  staffToken?: string | null
  signal?: AbortSignal
  headers?: Record<string, string>
}

type FetchLike = typeof fetch

function joinUrl(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/** Parse hub problem JSON body; falls back when shape is unexpected. */
export function parseHubProblem(raw: unknown, status: number): HubProblem {
  if (raw && typeof raw === 'object' && 'error' in raw) {
    const err = (raw as { error: unknown }).error
    if (err && typeof err === 'object') {
      const problem = err as Record<string, unknown>
      const code =
        typeof problem.code === 'string' ? problem.code : 'UNKNOWN_ERROR'
      const message =
        typeof problem.message === 'string'
          ? problem.message
          : `Request failed (${status})`
      const details =
        problem.details &&
        typeof problem.details === 'object' &&
        !Array.isArray(problem.details)
          ? (problem.details as Record<string, unknown>)
          : {}
      return { code, message, details }
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: `Request failed (${status})`,
    details: {},
  }
}

/** Build auth headers from options or session storage. */
export function buildAuthHeaders(options: ApiRequestOptions = {}): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }

  const deviceToken =
    options.deviceToken !== undefined
      ? options.deviceToken
      : getDeviceToken()
  if (deviceToken) {
    headers['X-Device-Token'] = deviceToken
  }

  const staffToken =
    options.staffToken !== undefined ? options.staffToken : getStaffToken()
  if (staffToken) {
    headers['X-Staff-Token'] = staffToken
  }

  return headers
}

async function request<T>(
  method: string,
  path: string,
  options: ApiRequestOptions = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const headers = {
    ...buildAuthHeaders(options),
  } as Record<string, string>

  const init: RequestInit = {
    method,
    headers,
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }
  if (options.signal !== undefined) {
    init.signal = options.signal
  }

  const response = await fetchImpl(joinUrl(getEdgeApiUrl(), path), init)

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    throw new HubApiError(parseHubProblem(payload, response.status), response.status)
  }

  if (response.status === 204 || text === '') {
    return undefined as T
  }

  return payload as T
}

export type HubApiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) => Promise<T>
  post: <T>(path: string, options?: ApiRequestOptions) => Promise<T>
  patch: <T>(path: string, options?: ApiRequestOptions) => Promise<T>
  put: <T>(path: string, options?: ApiRequestOptions) => Promise<T>
  delete: <T>(path: string, options?: ApiRequestOptions) => Promise<T>
}

/** Create a hub API client (inject fetch in tests). */
export function createHubApiClient(fetchImpl: FetchLike = fetch): HubApiClient {
  return {
    get: (path, options) => request('GET', path, options, fetchImpl),
    post: (path, options) => request('POST', path, options, fetchImpl),
    patch: (path, options) => request('PATCH', path, options, fetchImpl),
    put: (path, options) => request('PUT', path, options, fetchImpl),
    delete: (path, options) => request('DELETE', path, options, fetchImpl),
  }
}

export const api = createHubApiClient()
