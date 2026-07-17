import { describe, expect, it } from 'vitest'
import {
  requiresSetupManage,
  roleHasPermission,
} from '../lib/permissions.js'

describe('permissions', () => {
  it('gives setup.manage to ADMIN only by default', () => {
    expect(roleHasPermission('ADMIN', 'setup.manage')).toBe(true)
    expect(roleHasPermission('COUNTER', 'setup.manage')).toBe(false)
    expect(roleHasPermission('WAITER', 'setup.manage')).toBe(false)
  })

  it('marks setup catalog writes as requiring setup.manage', () => {
    expect(requiresSetupManage('POST', '/v1/menu/items')).toBe(true)
    expect(requiresSetupManage('PATCH', '/v1/zones/z1')).toBe(true)
    expect(requiresSetupManage('PUT', '/v1/location/billing-config')).toBe(true)
    expect(requiresSetupManage('GET', '/v1/menu/items')).toBe(false)
    expect(requiresSetupManage('POST', '/v1/orders')).toBe(false)
    expect(requiresSetupManage('POST', '/v1/auth/staff/login')).toBe(false)
  })
})
