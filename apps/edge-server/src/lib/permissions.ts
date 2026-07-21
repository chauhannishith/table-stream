import type { StaffRole } from '@table-stream/shared-types/domain'

export type Permission =
  | 'orders.create'
  | 'orders.edit'
  | 'orders.delete'
  | 'orders.submit'
  | 'orders.bill'
  | 'orders.void'
  | 'setup.manage'

const ROLE_DEFAULTS: Record<StaffRole, readonly Permission[]> = {
  ADMIN: [
    'orders.create',
    'orders.edit',
    'orders.delete',
    'orders.submit',
    'orders.bill',
    'orders.void',
    'setup.manage',
  ],
  COUNTER: [
    'orders.create',
    'orders.edit',
    'orders.delete',
    'orders.submit',
    'orders.bill',
  ],
  WAITER: [
    'orders.create',
    'orders.edit',
    'orders.delete',
    'orders.submit',
    'orders.bill',
  ],
}

const SETUP_WRITE_PREFIXES = [
  '/v1/menu',
  '/v1/zones',
  '/v1/tables',
  '/v1/staff',
  '/v1/location/billing-config',
  '/v1/location/print-config',
  '/v1/kds-stations',
  '/v1/printers',
] as const

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Whether a role includes a permission under default role sets. */
export function roleHasPermission(
  role: string,
  permission: Permission,
): boolean {
  const defaults = ROLE_DEFAULTS[role as StaffRole]
  if (!defaults) return false
  return defaults.includes(permission)
}

/** Setup catalog/layout writes that require `setup.manage`. */
export function requiresSetupManage(
  method: string,
  pathname: string,
): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return false
  return SETUP_WRITE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
