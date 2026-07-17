import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import {
  requiresSetupManage,
  roleHasPermission,
} from '../lib/permissions.js'
import {
  getStaffSessionByToken,
  type StaffSessionRecord,
} from '../lib/staff-sessions.js'

/** Paths that never require a staff session for setup checks. */
export function isStaffAuthExempt(pathname: string): boolean {
  if (pathname === '/v1/auth/staff/login') return true
  return !pathname.startsWith('/v1/')
}

/** Require X-Staff-Token + setup.manage on catalog/layout writes. */
export const staffAuthPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('staffSession', null)

  app.addHook('onRequest', async (request) => {
    const pathname = request.url.split('?')[0] ?? request.url
    if (isStaffAuthExempt(pathname)) return
    if (!requiresSetupManage(request.method, pathname)) return

    const raw = request.headers['x-staff-token']
    const token = typeof raw === 'string' ? raw.trim() : ''
    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Missing staff token', 401)
    }

    const session = getStaffSessionByToken(token)
    if (!session) {
      throw new AppError('UNAUTHORIZED', 'Invalid staff token', 401)
    }

    if (session.locationId !== app.hubConfig.location_id) {
      throw new AppError('UNAUTHORIZED', 'Invalid staff token', 401)
    }

    if (!roleHasPermission(session.role, 'setup.manage')) {
      throw new AppError(
        'FORBIDDEN',
        'Insufficient permissions for setup',
        403,
        { permission: 'setup.manage', role: session.role },
      )
    }

    request.staffSession = session
  })
}

declare module 'fastify' {
  interface FastifyRequest {
    staffSession: StaffSessionRecord | null
  }
}
