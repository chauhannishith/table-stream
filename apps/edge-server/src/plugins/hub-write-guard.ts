import type { FastifyPluginAsync } from 'fastify'
import { assertHubWritable } from '../lib/hub-guard.js'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Paths that stay writable when the hub is suspended (archive/admin access). */
const SUSPENDED_WRITE_PATHS = new Set(['/v1/auth/staff/login'])

/** Whether a request bypasses the suspended-hub write block. */
export function isHubWriteGuardExempt(method: string, pathname: string): boolean {
  if (READ_METHODS.has(method.toUpperCase())) return true
  return SUSPENDED_WRITE_PATHS.has(pathname)
}

/** Block mutating /v1 routes when hub_status is SUSPENDED; reads stay allowed. */
export const hubWriteGuardPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request) => {
    const pathname = request.url.split('?')[0] ?? request.url
    if (isHubWriteGuardExempt(request.method, pathname)) return
    if (!pathname.startsWith('/v1/')) return

    assertHubWritable(app.hubDb, app.hubConfig.location_id)
  })
}
