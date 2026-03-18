import { createContext } from 'react'
import type {
  FeatureFlags,
  PublicSiteSettings,
  SessionUser,
  SiteMetadataSettings,
  SiteProfileSettings,
  SocialLink,
} from '@shared/index'

export interface AuthContextValue {
  loading: boolean
  bootstrapRequired: boolean
  user: SessionUser | null
  featureFlags: FeatureFlags | null
  profile: SiteProfileSettings | null
  metadata: SiteMetadataSettings | null
  publicSettings: PublicSiteSettings | null
  socialLinks: SocialLink[]
  error: string | null
  refreshSession: () => Promise<void>
  login: (payload: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
