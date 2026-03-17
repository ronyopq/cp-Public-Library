import type { ReactElement } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import type { PermissionKey } from '@shared/index'
import { LoadingState } from '@/components/ui/LoadingState'
import { AppShell } from '@/app/AppShell'
import { useAuth } from '@/providers/useAuth'
import { AccountPage } from '@/features/account/AccountPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetupPage } from '@/features/auth/SetupPage'
import { BookIntakePage } from '@/features/catalog/BookIntakePage'
import { PlaceholderPage } from '@/features/common/PlaceholderPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AuditLogsPage } from '@/features/settings/AuditLogsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { UsersPage } from '@/features/users/UsersPage'

function ProtectedRoute({ permission }: { permission?: PermissionKey }) {
  const { loading, bootstrapRequired, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingState />
  }

  if (bootstrapRequired) {
    return <Navigate to="/setup" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user.mustChangePassword && location.pathname !== '/app/account') {
    return <Navigate to="/app/account" replace />
  }

  if (permission && !user.permissions.includes(permission)) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}

function PublicRoute({ children }: { children: ReactElement }) {
  const { loading, bootstrapRequired, user } = useAuth()

  if (loading) {
    return <LoadingState />
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  if (bootstrapRequired) {
    return children
  }

  return children
}

function RootRedirect() {
  const { loading, bootstrapRequired, user } = useAuth()

  if (loading) {
    return <LoadingState />
  }

  if (bootstrapRequired) {
    return <Navigate to="/setup" replace />
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <PublicRoute>
            <SetupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />

          <Route element={<ProtectedRoute permission="catalog.manage_metadata" />}>
            <Route path="books" element={<BookIntakePage />} />
          </Route>

          <Route
            path="members"
            element={<PlaceholderPage title="সদস্য মডিউল" permission="members.manage" />}
          />
          <Route
            path="circulation"
            element={<PlaceholderPage title="ইস্যু ও রিটার্ন" permission="circulation.manage" />}
          />
          <Route
            path="accounts"
            element={<PlaceholderPage title="হিসাব মডিউল" permission="accounts.view" />}
          />
          <Route
            path="competitions"
            element={
              <PlaceholderPage
                title="প্রতিযোগিতা মডিউল"
                permission="competitions.manage"
              />
            }
          />
          <Route
            path="printing"
            element={<PlaceholderPage title="প্রিন্ট সেন্টার" permission="prints.manage" />}
          />

          <Route element={<ProtectedRoute permission="users.manage" />}>
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="settings.manage" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="audit.view" />}>
            <Route path="audit" element={<AuditLogsPage />} />
          </Route>

          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
