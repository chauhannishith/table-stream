import type { DeviceType } from '@table-stream/shared-types/domain'
import { api, type HubApiClient } from './api-client'
import { setDeviceToken } from './auth-storage'
import { setStoredDeviceType } from './device-type'

export type PairedDevice = {
  id: string
  location_id: string
  device_type: DeviceType
  name: string
  is_active: boolean
}

export type PairDeviceResponse = {
  device: PairedDevice
  device_token: string
}

export type PairDeviceInput = {
  pairingCode: string
  deviceType: DeviceType
  name: string
}

/** Pair with hub pairing code and persist device_token + device_type locally. */
export async function pairAndStoreDevice(
  input: PairDeviceInput,
  client: HubApiClient = api,
): Promise<PairDeviceResponse> {
  const pairingCode = input.pairingCode.trim()
  const name = input.name.trim()

  const result = await client.post<PairDeviceResponse>('/v1/devices/pair', {
    body: {
      pairing_code: pairingCode,
      device_type: input.deviceType,
      name,
    },
    deviceToken: null,
    staffToken: null,
  })

  setDeviceToken(result.device_token)
  setStoredDeviceType(result.device.device_type)
  return result
}
