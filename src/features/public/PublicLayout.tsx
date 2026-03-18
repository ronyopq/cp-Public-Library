import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/providers/useAuth'

export function PublicLayout() {
  const { featureFlags, profile, publicSettings, socialLinks, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const menuItems = [
    featureFlags?.public_catalog_enabled && publicSettings?.menu.catalog
      ? { to: '/catalog', label: 'ক্যাটালগ' }
      : null,
    publicSettings?.menu.analytics ? { to: '/analytics', label: 'অ্যানালিটিক্স' } : null,
    featureFlags?.competitions_module_enabled && publicSettings?.menu.competitions
      ? { to: '/competitions', label: 'প্রতিযোগিতা' }
      : null,
    featureFlags?.competitions_module_enabled &&
    publicSettings?.menu.results &&
    publicSettings?.competition.resultsVisible
      ? { to: '/competitions/results', label: 'ফলাফল' }
      : null,
  ].filter(Boolean) as Array<{ to: string; label: string }>

  const homePath = menuItems[0]?.to ?? '/login'

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header__bar">
          <NavLink to={homePath} className="public-brand" onClick={() => setMenuOpen(false)}>
            <AppLogo profile={profile} />
          </NavLink>

          <div className="public-header__actions">
            <Button
              type="button"
              className="menu-toggle"
              variant="ghost"
              onClick={() => setMenuOpen((current) => !current)}
            >
              মেনু
            </Button>
            {user ? (
              <NavLink to="/app">
                <Button type="button">ড্যাশবোর্ড</Button>
              </NavLink>
            ) : (
              <NavLink to="/login">
                <Button type="button" variant="ghost">
                  লগইন
                </Button>
              </NavLink>
            )}
          </div>
        </div>

        <nav className={`public-nav${menuOpen ? ' is-open' : ''}`}>
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `public-nav__link${isActive ? ' is-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="public-footer">
        <div>
          <strong>{profile?.siteNameBn ?? 'কমিউনিটি লাইব্রেরি'}</strong>
          <p>{profile?.taglineBn ?? 'বাংলা-প্রথম পাঠকসেবা, ক্যাটালগ ও ফলাফল প্ল্যাটফর্ম'}</p>
        </div>
        <div className="public-footer__links">
          {socialLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
