import { NavLink } from 'react-router-dom'
import {
  AgentsIcon,
  AuditIcon,
  DashboardIcon,
  IntegrationsIcon,
  OrdersIcon,
  PreferencesIcon,
  ProductsIcon,
  ProfileIcon,
  WorkspaceIcon,
} from '../common/Icons'
import { useApp } from '../../context/AppContext'

const links = [
  { label: 'Dashboard', to: '/app/dashboard', icon: DashboardIcon, onboardingId: 'dashboard' },
  { label: 'Products', to: '/app/products', icon: ProductsIcon, onboardingId: 'products' },
  { label: 'Agents', to: '/app/agents', icon: AgentsIcon, onboardingId: 'agents' },
  { label: 'Orders', to: '/app/orders', icon: OrdersIcon, onboardingId: 'orders' },
  { label: 'Integrations', to: '/app/integrations', icon: IntegrationsIcon, onboardingId: 'integrations' },
  { label: 'Audit Logs', to: '/app/audit-logs', icon: AuditIcon, roles: ['owner', 'admin'] },
  { label: 'Profile Settings', to: '/app/settings/profile', icon: ProfileIcon, onboardingId: 'settings-profile' },
  { label: 'Workspace Settings', to: '/app/settings/workspace', icon: WorkspaceIcon },
  { label: 'Agent Preferences', to: '/app/settings/agents', icon: PreferencesIcon },
]

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

export const Sidebar = ({ className = '', onNavigate }: SidebarProps) => {
  const {
    state: { user }
  } = useApp()

  const visibleLinks = links.filter((link) => !link.roles || link.roles.includes(user?.role ?? 'viewer'))

  return (
    <aside className={`sidebar ${className}`.trim()}>
      <NavLink to="/" className="brand">
        <span className="brand-icon-wrap">
          <img src="/turbotillicon.png" alt="TurboTill icon" className="brand-icon-image" />
        </span>
        <div>
          <span className="brand-logo-shell">
            <img src="/turbotillLogo.png" alt="TurboTill" className="brand-logo-image" />
          </span>
        </div>
      </NavLink>
      <nav className="sidebar-nav">
        {visibleLinks.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              data-onboarding-id={link.onboardingId}
              onClick={onNavigate}
            >
              <Icon className="sidebar-link-icon" />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
