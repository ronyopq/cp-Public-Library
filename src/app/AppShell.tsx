import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { FeatureFlagKey, PermissionKey } from '@shared/index'
import { ROLE_RANK } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

interface ShellPayload {
  user: {
    role: keyof typeof ROLE_RANK
    permissions: PermissionKey[]
  }
  featureFlags: Record<FeatureFlagKey, boolean>
  settings: {
    profile: any
    menuConfig: Array<{ key: string; enabled: boolean; order: number }>
  }
}

interface MenuBlueprint {
  key: string
  href: string
  labelBn: string
  icon: string
  permission?: PermissionKey
  featureFlag?: FeatureFlagKey
}

const menuBlueprints: MenuBlueprint[] = [
  { key: 'dashboard', href: '/app', labelBn: 'ড্যাশবোর্ড', icon: 'ড' },
  {
    key: 'books',
    href: '/app/books',
    labelBn: 'বই',
    icon: 'ব',
    permission: 'catalog.manage_metadata' as PermissionKey,
  },
  {
    key: 'members',
    href: '/app/members',
    labelBn: 'সদস্য',
    icon: 'স',
    permission: 'members.manage' as PermissionKey,
  },
  {
    key: 'circulation',
    href: '/app/circulation',
    labelBn: 'ইস্যু',
    icon: 'ই',
    permission: 'circulation.manage' as PermissionKey,
  },
  {
    key: 'accounts',
    href: '/app/accounts',
    labelBn: 'হিসাব',
    icon: 'হি',
    permission: 'accounts.view' as PermissionKey,
  },
  {
    key: 'competitions',
    href: '/app/competitions',
    labelBn: 'প্রতিযোগিতা',
    icon: 'প',
    permission: 'competitions.manage' as PermissionKey,
    featureFlag: 'competitions_module_enabled' as FeatureFlagKey,
  },
  {
    key: 'printing',
    href: '/app/printing',
    labelBn: 'প্রিন্ট',
    icon: 'পৃ',
    permission: 'prints.manage' as PermissionKey,
    featureFlag: 'print_center_enabled' as FeatureFlagKey,
  },
  {
    key: 'users',
    href: '/app/users',
    labelBn: 'ইউজার',
    icon: 'ইউ',
    permission: 'users.manage' as PermissionKey,
  },
  {
    key: 'settings',
    href: '/app/settings',
    labelBn: 'সেটিংস',
    icon: 'সে',
    permission: 'settings.manage' as PermissionKey,
  },
  {
    key: 'audit',
    href: '/app/audit',
    labelBn: 'অডিট',
    icon: 'অ',
    permission: 'audit.view' as PermissionKey,
  },
  {
    key: 'account',
    href: '/app/account',
    labelBn: 'আমার একাউন্ট',
    icon: 'আ',
  },
] as const

export function AppShell() {
  const { logout, user, profile } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const shellQuery = useQuery({
    queryKey: ['app-shell'],
    queryFn: () => apiRequest<ShellPayload>('/api/app/shell'),
  })

  if (shellQuery.isLoading || !user) {
    return <LoadingState />
  }

  const shell = shellQuery.data
  if (!shell) {
    return <LoadingState />
  }
  const menuConfigMap = new Map(shell.settings.menuConfig.map((item) => [item.key, item]))
  const visibleMenuItems = menuBlueprints
    .filter((item) => {
      if (item.permission && !user.permissions.includes(item.permission)) {
        return false
      }
      if (item.featureFlag && !shell.featureFlags[item.featureFlag]) {
        return false
      }

      return menuConfigMap.get(item.key)?.enabled ?? true
    })
    .sort((left, right) => {
      const leftOrder = menuConfigMap.get(left.key)?.order ?? 99
      const rightOrder = menuConfigMap.get(right.key)?.order ?? 99
      return leftOrder - rightOrder
    })

  return (
    <div className="shell">
      <aside className={`shell-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <AppLogo profile={shell.settings.profile ?? profile} />
        <nav className="shell-nav">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.href}
              end={item.href === '/app'}
              className={({ isActive }) => `shell-nav__link${isActive ? ' is-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="shell-nav__icon">{item.icon}</span>
              <span>{item.labelBn}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-card">
          <p className="muted">বর্তমান ভূমিকা</p>
          <strong>{user.role.replaceAll('_', ' ')}</strong>
          <p className="muted">
            {user.permissions.length}টি পারমিশন সক্রিয়
          </p>
        </div>
      </aside>

      <main className="shell-main">
        <div className="shell-topbar content-card">
          <div>
            <Button className="menu-toggle" type="button" variant="ghost" onClick={() => setSidebarOpen((open) => !open)}>
              মেনু
            </Button>
            <p className="muted">স্বাগতম, {user.nameBn}</p>
          </div>
          <div className="shell-topbar__actions">
            {user.mustChangePassword ? (
              <span className="warning-banner">প্রথমে পাসওয়ার্ড পরিবর্তন করুন</span>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => void logout()}>
              লগআউট
            </Button>
          </div>
        </div>
        <Outlet context={{ shell, roleRank: ROLE_RANK[user.role] }} />
      </main>
    </div>
  )
}
