import { http, HttpResponse } from 'msw'
import {
  bumpStaffSeq,
  nowIso,
  staffMembers,
  toStaffDto,
  type StaffRecord,
} from './stores'

export const staffHandlers = [
  http.get('*/v1/staff', ({ request }) => {
    const includeInactive =
      new URL(request.url).searchParams.get('include_inactive') === 'true'
    const list = [...staffMembers.values()]
      .filter((member) => includeInactive || member.is_active)
      .map(toStaffDto)
    return HttpResponse.json({ staff: list })
  }),

  http.post('*/v1/staff', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string
      role?: string
      pin?: string
      is_active?: boolean
    }
    if (!body.name?.trim() || !body.role || !body.pin) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name, role, and pin are required',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    if (
      body.role !== 'ADMIN' &&
      body.role !== 'COUNTER' &&
      body.role !== 'WAITER'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid staff role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }
    if (!/^\d{4,8}$/.test(body.pin.trim())) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'PIN must be 4–8 digits',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const timestamp = nowIso()
    const member: StaffRecord = {
      id: `st_${bumpStaffSeq()}`,
      location_id: 'loc_test',
      name: body.name.trim(),
      role: body.role,
      assigned_zone_ids: [],
      is_active: body.is_active ?? true,
      created_at: timestamp,
      updated_at: timestamp,
      pin: body.pin.trim(),
    }
    staffMembers.set(member.id, member)
    return HttpResponse.json({ staff: toStaffDto(member) }, { status: 201 })
  }),

  http.patch('*/v1/staff/:id', async ({ params, request }) => {
    const id = String(params.id)
    const existing = staffMembers.get(id)
    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Staff not found',
            details: { id },
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      role?: string
      pin?: string
      is_active?: boolean
    }

    if (
      body.role !== undefined &&
      body.role !== 'ADMIN' &&
      body.role !== 'COUNTER' &&
      body.role !== 'WAITER'
    ) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid staff role',
            details: { role: body.role },
          },
        },
        { status: 400 },
      )
    }

    if (body.pin !== undefined && !/^\d{4,8}$/.test(body.pin.trim())) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'PIN must be 4–8 digits',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    const member: StaffRecord = {
      ...existing,
      name: body.name?.trim() || existing.name,
      role: (body.role as StaffRecord['role'] | undefined) ?? existing.role,
      pin: body.pin?.trim() || existing.pin,
      is_active: body.is_active ?? existing.is_active,
      updated_at: nowIso(),
    }
    staffMembers.set(id, member)
    return HttpResponse.json({ staff: toStaffDto(member) })
  }),
]
