import type { FastifyPluginAsync } from 'fastify'
import { DeviceType } from '@table-stream/shared-types/domain'
import { AppError } from '../lib/errors.js'
import {
  createDevicePairingCode,
  pairDevice,
} from '../services/device-pairing.js'

function parseDeviceType(value: string | undefined): DeviceType {
  if (!value) {
    throw new AppError('VALIDATION_ERROR', 'device_type is required', 400)
  }
  const parsed = DeviceType.safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid device_type', 400, {
      device_type: value,
    })
  }
  return parsed.data
}

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  app.post('/devices/pairing-codes', async () => {
    return createDevicePairingCode(app.hubConfig.location_id)
  })

  app.post('/devices/pair', async (request) => {
    const body = request.body as {
      pairing_code?: string
      device_type?: string
      name?: string
    }

    if (!body?.pairing_code?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'pairing_code is required', 400)
    }

    return pairDevice(app.hubDb, app.hubConfig.location_id, {
      pairingCode: body.pairing_code,
      deviceType: parseDeviceType(body.device_type),
      name: body.name ?? '',
    })
  })
}
