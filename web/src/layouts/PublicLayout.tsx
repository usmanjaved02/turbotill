import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '../components/common/Button'

const links = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export const PublicLayout = () => {
  return (
    <div className="public-layout">
      <header className="public-header">
        <NavLink to="/" className="brand">
          <span className="brand-icon-wrap">
            <img src="/turbotillicon.png" alt="TurboTill icon" className="brand-icon-image" />
          </span>
          <span className="brand-logo-shell">
            <img src="/turbotillLogo.png" alt="TurboTill" className="brand-logo-image" />
          </span>
        </NavLink>
        <nav className="public-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="row gap-sm">
          <NavLink to="/login">
            <Button variant="ghost" size="sm">
              Login
            </Button>
          </NavLink>
          <NavLink to="/signup">
            <Button size="sm">Get Started</Button>
          </NavLink>
        </div>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <div className="sticky-cta">
        <p>Launch Terminal or Table agents in minutes.</p>
        <NavLink to="/signup">
          <Button size="sm">Start free</Button>
        </NavLink>
      </div>
    </div>
  )
}
