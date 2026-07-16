import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../lib/errors.js'
import { pickDefined } from '../lib/pick-defined.js'
import { trimOptionalNonEmpty } from '../lib/validate-patch.js'
import {
  createStaffEntry,
  listStaffForLocation,
  parseStaffRole,
  updateStaffEntry,
} from '../services/floor-setup.js'

export const staffRoutes: FastifyPluginAsync = async (app) => {
  app.get('/staff', async (request) => {
    const query = request.query as { include_inactive?: string }

    return {
      staff: listStaffForLocation(app.hubDb, app.hubConfig.location_id, {
        includeInactive: query.include_inactive === 'true',
      }),
    }
  })

  app.post('/staff', async (request, reply) => {
    const body = request.body as {
      name?: string
      role?: string
      pin?: string
      assigned_zone_ids?: string[]
      is_active?: boolean
    }

    if (!body?.name?.trim() || !body?.role || !body?.pin) {
      throw new AppError(
        'VALIDATION_ERROR',
        'name, role, and pin are required',
        400,
      )
    }

    const member = createStaffEntry(app.hubDb, app.hubConfig.location_id, {
      name: body.name.trim(),
      role: parseStaffRole(body.role),
      pin: body.pin,
      ...pickDefined({
        assignedZoneIds: body.assigned_zone_ids,
        isActive: body.is_active,
      }),
    })

    return reply.status(201).send({ staff: member })
  })

  app.patch('/staff/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      role?: string
      pin?: string
      assigned_zone_ids?: string[]
      is_active?: boolean
    }

    const member = updateStaffEntry(
      app.hubDb,
      app.hubConfig.location_id,
      id,
      pickDefined({
        name: trimOptionalNonEmpty('name', body?.name),
        role: body?.role ? parseStaffRole(body.role) : undefined,
        pin: body?.pin,
        assignedZoneIds: body?.assigned_zone_ids,
        isActive: body?.is_active,
      }),
    )

    if (!member) {
      throw new AppError('NOT_FOUND', 'Staff not found', 404, { id })
    }

    return reply.send({ staff: member })
  })
}
