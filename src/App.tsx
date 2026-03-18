import type { ReactElement } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import type { PermissionKey } from '@shared/index'
import { LoadingState } from '@/components/ui/LoadingState'
import { AppShell } from '@/app/AppShell'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { useAuth } from '@/providers/useAuth'
import { AccountPage } from '@/features/account/AccountPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetupPage } from '@/features/auth/SetupPage'
import { BookIntakePage } from '@/features/catalog/BookIntakePage'
import { CompetitionsPage } from '@/features/competitions/CompetitionsPage'
import { PlaceholderPage } from '@/features/common/PlaceholderPage'
import { CompetitionAcknowledgementPage } from '@/features/public/CompetitionAcknowledgementPage'
import { PublicAnalyticsPage } from '@/features/public/PublicAnalyticsPage'
import { PublicBookPage } from '@/features/public/PublicBookPage'
import { PublicCatalogPage } from '@/features/public/PublicCatalogPage'
import { PublicCompetitionDetailPage } from '@/features/public/PublicCompetitionDetailPage'
import { PublicCompetitionResultsPage } from '@/features/public/PublicCompetitionResultsPage'
import { PublicCompetitionsPage } from '@/features/public/PublicCompetitionsPage'
import { PublicLayout } from '@/features/public/PublicLayout'
import { PublicQrPage } from '@/features/public/PublicQrPage'
import { CirculationPage } from '@/features/circulation/CirculationPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MembersPage } from '@/features/members/MembersPage'
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

function PublicSiteRoute() {
  const { loading, bootstrapRequired } = useAuth()

  if (loading) {
    return <LoadingState />
  }

  if (bootstrapRequired) {
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}

function RootRedirect() {
  const { loading, bootstrapRequired, featureFlags, publicSettings, user } = useAuth()

  if (loading) {
    return <LoadingState />
  }

  if (bootstrapRequired) {
    return <Navigate to="/setup" replace />
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  if (featureFlags?.public_catalog_enabled && publicSettings?.menu.catalog !== false) {
    return <Navigate to="/catalog" replace />
  }

  if (publicSettings?.menu.analytics !== false) {
    return <Navigate to="/analytics" replace />
  }

  if (
    featureFlags?.competitions_module_enabled &&
    publicSettings?.menu.competitions !== false
  ) {
    return <Navigate to="/competitions" replace />
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

      <Route element={<PublicSiteRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/catalog" element={<PublicCatalogPage />} />
          <Route path="/analytics" element={<PublicAnalyticsPage />} />
          <Route path="/books/:recordId/:slug" element={<PublicBookPage />} />
          <Route path="/qr/:shortCode" element={<PublicQrPage />} />
          <Route path="/competitions" element={<PublicCompetitionsPage />} />
          <Route path="/competitions/results" element={<PublicCompetitionResultsPage />} />
          <Route path="/competitions/:slug" element={<PublicCompetitionDetailPage />} />
          <Route path="/competitions/:slug/results" element={<PublicCompetitionDetailPage />} />
          <Route
            path="/competitions/acknowledgements/:registrationId"
            element={<CompetitionAcknowledgementPage />}
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />

          <Route element={<ProtectedRoute permission="catalog.manage_metadata" />}>
            <Route path="books" element={<BookIntakePage />} />
          </Route>

          <Route element={<ProtectedRoute permission="members.manage" />}>
            <Route path="members" element={<MembersPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="circulation.manage" />}>
            <Route path="circulation" element={<CirculationPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="accounts.view" />}>
            <Route path="accounts" element={<AccountsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="competitions.manage" />}>
            <Route path="competitions" element={<CompetitionsPage />} />
          </Route>
          <Route
            path="printing"
            element={<PlaceholderPage title="Print center" permission="prints.manage" />}
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
