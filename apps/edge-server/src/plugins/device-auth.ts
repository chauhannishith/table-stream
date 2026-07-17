import type { FastifyPluginAsync } from 'fastify'
import { hashDeviceToken } from '../lib/auth.js'
import { AppError } from '../lib/errors.js'
import type { DeviceRow } from '../repositories/devices.js'
import {
  findActiveDeviceByTokenHash,
  touchDeviceLastSeen,
} from '../repositories/devices.js'

const EXEMPT_PATHS = new Set([
  '/health',
  '/health/ready',
  '/v1/status',
  '/v1/devices/pair',
  '/v1/devices/pairing-codes',
])

export function isDeviceAuthExempt(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true
  return !pathname.startsWith('/v1/')
}

export const deviceAuthPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('device', null)

  app.addHook('onRequest', async (request) => {
    const pathname = request.url.split('?')[0] ?? request.url
    if (isDeviceAuthExempt(pathname)) return

    const raw = request.headers['x-device-token']
    const token = typeof raw === 'string' ? raw.trim() : ''
    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Missing device token', 401)
    }

    const device = findActiveDeviceByTokenHash(
      app.hubDb,
      app.hubConfig.location_id,
      hashDeviceToken(token),
    )
    if (!device) {
      throw new AppError('UNAUTHORIZED', 'Invalid device token', 401)
    }

    request.device = device
    touchDeviceLastSeen(app.hubDb, app.hubConfig.location_id, device.id)
  })
}

declare module 'fastify' {
  interface FastifyRequest {
    device: DeviceRow | null
  }
}
