import type { ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export const Drawer = ({ open, onClose, title, children }: DrawerProps) => {
  return (
    <div className={`drawer-wrap ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close drawer" />
      <aside className="drawer">
        <header className="drawer-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close drawer">
            <CloseIcon />
          </button>
        </header>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  )
}
