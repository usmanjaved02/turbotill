import { Button } from '../common/Button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState = ({ title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="empty-state card">
    <h3>{title}</h3>
    <p>{description}</p>
    {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
  </div>
)
