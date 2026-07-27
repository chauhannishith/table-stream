import type { HubDb } from '../db/client.js'
import { loadHubConfig } from '../config.js'
import { createHubDb } from '../db/client.js'
import { hashPin } from '../lib/auth.js'
import {
  createStaff,
  listStaff,
  updateStaff,
} from '../repositories/staff.js'
import { seedHubFromConfig } from '../services/hub-seed.js'

const DEFAULT_NAME = 'Dev Admin'

export type BootstrapDevAdminInput = {
  name?: string
  pin?: string
}

export type BootstrapDevAdminResult = {
  staffId: string
  name: string
  pin: string
  created: boolean
}

function resolveName(name?: string): string {
  const raw = name?.trim() || process.env.DEV_ADMIN_NAME?.trim() || DEFAULT_NAME
  if (!raw) {
    throw new Error('DEV_ADMIN_NAME must be non-empty')
  }
  return raw
}

function resolvePin(pin?: string): string {
  const raw = pin?.trim() || process.env.DEV_ADMIN_PIN?.trim()
  if (!raw) {
    throw new Error(
      'Pairing code required (6 digits): make bootstrap-admin CODE=123456',
    )
  }
  if (!/^\d{6}$/.test(raw)) {
    throw new Error('Pairing code must be exactly 6 digits')
  }
  return raw
}

/** Idempotent dev bootstrap: ensure one ADMIN staff row with a known PIN. */
export function bootstrapDevAdminForLocation(
  db: HubDb,
  locationId: string,
  input: BootstrapDevAdminInput = {},
): BootstrapDevAdminResult {
  const name = resolveName(input.name)
  const pin = resolvePin(input.pin)
  const pinHash = hashPin(pin)

  const members = listStaff(db, locationId, { includeInactive: true })
  const existing =
    members.find((member) => member.name === name) ??
    members.find((member) => member.role === 'ADMIN')

  if (existing) {
    updateStaff(db, locationId, existing.id, {
      name,
      role: 'ADMIN',
      pinHash,
      isActive: true,
    })
    return { staffId: existing.id, name, pin, created: false }
  }

  const member = createStaff(db, locationId, {
    name,
    role: 'ADMIN',
    pinHash,
  })
  return { staffId: member.id, name, pin, created: true }
}

export function bootstrapDevAdmin(
  input: BootstrapDevAdminInput = {},
): BootstrapDevAdminResult {
  const config = loadHubConfig()
  const db = createHubDb(config)
  seedHubFromConfig(db, config)
  return bootstrapDevAdminForLocation(db, config.location_id, input)
}

function main() {
  const pin = process.argv[2]?.trim() || process.env.DEV_ADMIN_PIN?.trim()
  let result: BootstrapDevAdminResult
  try {
    result = bootstrapDevAdmin(pin ? { pin } : {})
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message)
    } else {
      console.error('bootstrap-admin failed')
    }
    process.exit(1)
  }

  const action = result.created ? 'Created' : 'Updated'
  console.log(`${action} dev admin: ${result.name} (${result.staffId})`)
  console.log(`Code ${result.pin} — use for device pairing AND staff PIN login`)
  console.log(
    'On tablet POS: pair as Counter with this code, then log in as Dev Admin.',
  )
}

const script = process.argv[1]
if (
  script &&
  (script.endsWith('bootstrap-admin.ts') ||
    script.endsWith('bootstrap-admin.js'))
) {
  main()
}
