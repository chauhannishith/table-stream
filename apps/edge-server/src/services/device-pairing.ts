import type { DeviceType } from '@table-stream/shared-types/domain'
import type { HubDb } from '../db/client.js'
import { hashDeviceToken, issueDeviceToken } from '../lib/auth.js'
import { AppError } from '../lib/errors.js'
import {
  consumePairingCode,
  issuePairingCode,
} from '../lib/pairing-codes.js'
import { createDevice, type DeviceRow } from '../repositories/devices.js'

export type PairDeviceInput = {
  pairingCode: string
  deviceType: DeviceType
  name: string
}

function toDeviceDto(row: DeviceRow) {
  return {
    id: row.id,
    location_id: row.locationId,
    device_type: row.deviceType,
    name: row.name,
    is_active: row.isActive,
    assigned_zone_ids: row.assignedZoneIdsJson
      ? (JSON.parse(row.assignedZoneIdsJson) as string[])
      : null,
    assigned_station_ids: row.assignedStationIdsJson
      ? (JSON.parse(row.assignedStationIdsJson) as string[])
      : null,
    last_seen_at: row.lastSeenAt,
    paired_at: row.pairedAt,
    updated_at: row.updatedAt,
  }
}

export function createDevicePairingCode(
  locationId: string,
  ttlMs = 5 * 60 * 1000,
) {
  const record = issuePairingCode(locationId, ttlMs)
  return {
    pairing_code: record.code,
    expires_at: new Date(record.expiresAtMs).toISOString(),
  }
}

export function pairDevice(
  db: HubDb,
  locationId: string,
  input: PairDeviceInput,
) {
  const ok = consumePairingCode(locationId, input.pairingCode)
  if (!ok) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired pairing code', 401, {
      pairing_code: input.pairingCode,
    })
  }

  const name = input.name.trim()
  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 400)
  }

  const deviceToken = issueDeviceToken()
  const row = createDevice(db, locationId, {
    deviceType: input.deviceType,
    name,
    deviceTokenHash: hashDeviceToken(deviceToken),
  })

  return {
    device: toDeviceDto(row),
    device_token: deviceToken,
  }
}
