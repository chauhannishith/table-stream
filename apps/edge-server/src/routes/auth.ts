import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { loginStaff } from '../services/staff-auth.js'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/staff/login', async (request) => {
    const body = request.body as {
      staff_id?: string
      pin?: string
    }

    if (!body?.staff_id?.trim() || !body?.pin?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'staff_id and pin are required',
        400,
      )
    }

    return loginStaff(app.hubDb, app.hubConfig.location_id, {
      staffId: body.staff_id,
      pin: body.pin,
    })
  })
}
