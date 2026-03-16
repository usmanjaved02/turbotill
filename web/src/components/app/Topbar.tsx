import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Dropdown } from '../common/Dropdown'
import { BellIcon, MenuIcon, SearchIcon } from '../common/Icons'
import { resolveAssetUrl } from '../../utils/assets'

interface TopbarProps {
  onSearchChange?: (value: string) => void
  onOpenMobileNav?: () => void
}

export const Topbar = ({ onSearchChange, onOpenMobileNav }: TopbarProps) => {
  const [search, setSearch] = useState('')
  const {
    state: { user },
    logout,
  } = useApp()
  const navigate = useNavigate()
  const initials = (user?.fullName ?? 'User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-btn mobile-nav-btn" onClick={onOpenMobileNav} aria-label="Open navigation">
          <MenuIcon />
        </button>
        <div className="workspace-chip">
          <span className="workspace-chip-logo">
            {user?.businessLogo ? (
              <img src={resolveAssetUrl(user.businessLogo)} alt={user.businessName} />
            ) : (
              <img src="/turbotillicon.png" alt="TurboTill icon" />
            )}
          </span>
          <span>{user?.businessName ?? 'Workspace'}</span>
        </div>
        <div className="search-wrap">
          <SearchIcon className="search-icon" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              onSearchChange?.(event.target.value)
            }}
            className="input search-input"
            placeholder="Search products, orders, agents..."
          />
        </div>
      </div>
      <div className="topbar-right">
        <button className="icon-btn notif-btn" aria-label="Notifications">
          <BellIcon />
          <span className="notif-dot" />
        </button>
        <Dropdown
          label={
            <span className="profile-trigger">
              <span className="avatar-mini">
                {user?.avatarUrl ? <img src={resolveAssetUrl(user.avatarUrl)} alt={user.fullName} /> : initials}
              </span>
              <span>{user?.fullName ?? 'User'}</span>
            </span>
          }
          items={[
            { label: 'Go to dashboard', onClick: () => navigate('/app/dashboard') },
            {
              label: 'Logout',
              onClick: async () => {
                await logout()
                navigate('/login', { replace: true })
              },
            },
          ]}
        />
      </div>
    </header>
  )
}
