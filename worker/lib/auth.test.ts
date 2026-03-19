import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@shared/index'
import { hasPermission } from './auth'

const sessionUser: SessionUser = {
  id: 'user-1',
  email: 'admin@example.org',
  nameBn: 'অ্যাডমিন',
  nameEn: 'Admin',
  phone: '01700000000',
  status: 'active',
  role: 'admin',
  roles: ['admin'],
  permissions: ['users.manage', 'audit.view', 'catalog.manage_metadata'],
  mustChangePassword: false,
}

describe('rbac helpers', () => {
  it('grants access when the permission exists', () => {
    expect(hasPermission(sessionUser, 'users.manage')).toBe(true)
  })

  it('denies access when the permission is missing or no user exists', () => {
    expect(hasPermission(sessionUser, 'accounts.manage')).toBe(false)
    expect(hasPermission(null, 'users.manage')).toBe(false)
  })
})
