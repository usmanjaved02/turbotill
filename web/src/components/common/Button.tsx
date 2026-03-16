import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Button = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  ...props
}: ButtonProps) => (
  <button className={`btn btn-${variant} btn-${size} ${className}`} {...props}>
    {iconLeft ? <span className="btn-icon">{iconLeft}</span> : null}
    <span>{children}</span>
    {iconRight ? <span className="btn-icon">{iconRight}</span> : null}
  </button>
)
