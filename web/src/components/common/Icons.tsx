import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

const IconBase = ({ size = 18, children, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`icon ${props.className ?? ''}`.trim()}
    {...props}
  >
    {children}
  </svg>
)

export const CloseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </IconBase>
)

export const BellIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M14.5 18a2.5 2.5 0 0 1-5 0" />
    <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
  </IconBase>
)

export const SearchIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </IconBase>
)

export const ChevronDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m6 9 6 6 6-6" />
  </IconBase>
)

export const MenuIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </IconBase>
)

export const MicIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
    <path d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8" />
  </IconBase>
)

export const DashboardIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
  </IconBase>
)

export const TourIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 20H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    <path d="M15 4h6v6" />
    <path d="m21 4-7 7" />
    <path d="m14 14 1.2 2.4L18 17l-2 1.8.5 2.7-2.5-1.4-2.5 1.4.5-2.7L9 17l2.8-.6L13 14z" />
  </IconBase>
)

export const ProductsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </IconBase>
)

export const AgentsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="5" y="6" width="14" height="11" rx="3" />
    <circle cx="9.5" cy="11.5" r="1" />
    <circle cx="14.5" cy="11.5" r="1" />
    <path d="M9 15h6M12 6V3" />
  </IconBase>
)

export const OrdersIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 3h10l5 5v13H6z" />
    <path d="M16 3v5h5M10 12h6M10 16h8" />
  </IconBase>
)

export const IntegrationsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 8V4a2 2 0 0 1 2-2h2" />
    <path d="M15 16v4a2 2 0 0 1-2 2h-2" />
    <path d="M7 10h10a2 2 0 1 1 0 4H7a2 2 0 1 1 0-4Z" />
  </IconBase>
)

export const AuditIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 4h12" />
    <path d="M6 10h12" />
    <path d="M6 16h7" />
    <path d="M17 14v6l2-1.2L21 20v-6" />
  </IconBase>
)

export const ProfileIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </IconBase>
)

export const WorkspaceIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 21V6l8-3 8 3v15" />
    <path d="M9 10h1M14 10h1M9 14h1M14 14h1M11 21v-4h2v4" />
  </IconBase>
)

export const PreferencesIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 6h9M16 6h4M10 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
    <path d="M4 12h4M11 12h9M15 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
    <path d="M4 18h11M18 18h2M14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
  </IconBase>
)

export const SparkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m12 2 2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2L12 2Z" />
  </IconBase>
)

export const PlayIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 6v12l10-6-10-6Z" />
  </IconBase>
)

export const StopIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </IconBase>
)
