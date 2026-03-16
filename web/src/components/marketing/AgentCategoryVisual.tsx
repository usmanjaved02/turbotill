import type { AgentType } from '../../types'

interface AgentCategoryVisualProps {
  type: AgentType
}

export const AgentCategoryVisual = ({ type }: AgentCategoryVisualProps) => {
  if (type === 'terminal') {
    return (
      <span className={`agent-category-visual type-${type}`} aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <defs>
            <linearGradient id="terminalGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#44A7FF" />
              <stop offset="100%" stopColor="#1E59D8" />
            </linearGradient>
          </defs>
          <rect x="9" y="12" width="46" height="30" rx="8" fill="url(#terminalGlow)" />
          <rect x="14" y="17" width="36" height="20" rx="5" fill="#ECF4FF" />
          <path d="M21 25l4 3-4 3" stroke="#2E5EA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M29 31h14" stroke="#2E5EA5" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M28 45h8v4h10v3H18v-3h10z" fill="#27487C" />
        </svg>
      </span>
    )
  }

  if (type === 'table_order_taker') {
    return (
      <span className={`agent-category-visual type-${type}`} aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <defs>
            <linearGradient id="tableGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#24C4A9" />
              <stop offset="100%" stopColor="#0B8C9C" />
            </linearGradient>
          </defs>
          <rect x="12" y="14" width="40" height="26" rx="8" fill="url(#tableGlow)" />
          <rect x="17" y="19" width="17" height="16" rx="3" fill="#E8FFFA" />
          <path d="M19 23h13M19 27h13M19 31h13" stroke="#2A6E7E" strokeWidth="1.7" strokeLinecap="round" />
          <rect x="38" y="20" width="10" height="14" rx="2" fill="#E8FFFA" />
          <path d="M43 41v8M22 41v8M30 41v8M38 41v8" stroke="#1C5C6C" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M16 49h32" stroke="#1C5C6C" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  return (
    <span className={`agent-category-visual type-${type}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <defs>
          <linearGradient id="whatsGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7A88FF" />
            <stop offset="100%" stopColor="#5A3CF0" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="29" r="19" fill="url(#whatsGlow)" />
        <path d="M22 44l2.4-6A15 15 0 1 1 42 42.8c-4.8 2.8-10.8 2.5-15.2-.7z" fill="#EFF0FF" opacity="0.9" />
        <path
          d="M28.7 25.5c.5-1 .9-1 1.3-1s.8 0 1.2.1c.4 0 .9-.1 1.3.9s1.4 3.2 1.5 3.4.2.6 0 .9-.4.6-.7 1-.6.7-.9 1.1c-.3.3-.5.7-.2 1.2.4.5 1.5 2.5 3.7 4 .7.5 1.3.8 1.7 1 .7.3 1 .2 1.4-.2.4-.4 1.6-1.8 2-2.4s.8-.5 1.3-.3c.5.2 3.4 1.7 4 2 .6.3 1 .5 1.2.8.2.3.2 1.7-.4 3.2s-2.8 2.8-3.8 3-2.1.3-7.1-1.7c-4.9-2.1-8.1-7.1-8.4-7.5-.3-.4-2-2.8-2-5.4s1.4-3.9 2-4.4z"
          fill="#5A3CF0"
        />
      </svg>
    </span>
  )
}

