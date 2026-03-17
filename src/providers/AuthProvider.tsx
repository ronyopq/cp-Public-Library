import { useEffect, useState } from 'react'
import type {
  FeatureFlags,
  SiteMetadataSettings,
  SiteProfileSettings,
  SocialLink,
} from '@shared/index'
import { apiPost, apiRequest, errorMessage, mediaUrl } from '@/lib/api'
import type { SessionUser } from '@shared/index'
import { AuthContext } from './auth-context'

interface SessionPayload {
  user: SessionUser | null
  featureFlags: FeatureFlags
  profile: SiteProfileSettings
  metadata: SiteMetadataSettings
}

interface SetupStatusPayload {
  bootstrapRequired: boolean
  profile: SiteProfileSettings
  metadata: SiteMetadataSettings
}

interface SiteConfigPayload {
  profile: SiteProfileSettings
  metadata: SiteMetadataSettings
  socialLinks: SocialLink[]
}

function applyDocumentBranding(
  metadata: SiteMetadataSettings | null,
  profile: SiteProfileSettings | null,
) {
  if (!metadata || !profile) {
    return
  }

  document.title = metadata.metaTitleBn || profile.siteNameBn
  const faviconUrl = mediaUrl(profile.faviconKey) ?? '/favicon.svg'
  const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
  if (favicon) {
    favicon.href = faviconUrl
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [bootstrapRequired, setBootstrapRequired] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null)
  const [profile, setProfile] = useState<SiteProfileSettings | null>(null)
  const [metadata, setMetadata] = useState<SiteMetadataSettings | null>(null)
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refreshSession() {
    setLoading(true)
    setError(null)

    try {
      const [setupStatus, siteConfig, session] = await Promise.all([
        apiRequest<SetupStatusPayload>('/api/public/setup/status'),
        apiRequest<SiteConfigPayload>('/api/public/site-config'),
        apiRequest<SessionPayload>('/api/auth/session'),
      ])

      setBootstrapRequired(setupStatus.bootstrapRequired)
      setUser(session.user)
      setFeatureFlags(session.featureFlags)
      setProfile(session.profile ?? siteConfig.profile)
      setMetadata(session.metadata ?? siteConfig.metadata)
      setSocialLinks(siteConfig.socialLinks)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function login(payload: { email: string; password: string }) {
    setError(null)
    const result = await apiPost<SessionPayload>('/api/auth/login', payload)
    setUser(result.user)
    setFeatureFlags(result.featureFlags)
    setProfile(result.profile)
    setMetadata(result.metadata)
    setBootstrapRequired(false)
  }

  async function logout() {
    await apiPost('/api/auth/logout', {})
    setUser(null)
    await refreshSession()
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  useEffect(() => {
    applyDocumentBranding(metadata, profile)
  }, [metadata, profile])

  return (
    <AuthContext.Provider
      value={{
        loading,
        bootstrapRequired,
        user,
        featureFlags,
        profile,
        metadata,
        socialLinks,
        error,
        refreshSession,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
