import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './Icons'

interface DropdownItem {
  label: string
  onClick: () => void | Promise<void>
  danger?: boolean
}

interface DropdownProps {
  label: string | ReactNode
  items: DropdownItem[]
}

export const Dropdown = ({ label, items }: DropdownProps) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="dropdown" ref={rootRef}>
      <button type="button" className="btn btn-ghost btn-sm dropdown-trigger" onClick={() => setOpen((prev) => !prev)}>
        <span className="dropdown-label">{label}</span>
        <ChevronDownIcon className={`caret-icon ${open ? 'open' : ''}`} />
      </button>
      {open ? (
        <div className="dropdown-menu">
          {items.map((item) => (
            <button
              key={item.label}
              className={`dropdown-item ${item.danger ? 'danger' : ''}`}
              onClick={async () => {
                await item.onClick()
                setOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
