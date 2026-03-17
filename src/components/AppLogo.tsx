import type { SiteProfileSettings } from '@shared/index'
import { mediaUrl } from '@/lib/api'

export function AppLogo({
  profile,
  compact = false,
}: {
  profile: SiteProfileSettings | null
  compact?: boolean
}) {
  return (
    <div className={`brand-lockup${compact ? ' is-compact' : ''}`}>
      {profile?.logoKey ? (
        <img className="brand-logo" src={mediaUrl(profile.logoKey) ?? ''} alt="" />
      ) : (
        <div className="brand-mark" aria-hidden="true">
          গ
        </div>
      )}
      <div>
        <div className="brand-title">{profile?.siteNameBn ?? 'কমিউনিটি গণগ্রন্থাগার'}</div>
        {!compact ? (
          <div className="brand-subtitle">
            {profile?.taglineBn ?? 'Bangla-first library operations'}
          </div>
        ) : null}
      </div>
    </div>
  )
}
