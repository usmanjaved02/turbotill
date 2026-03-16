import type { OrderStatus } from '../../types'
import { Badge } from '../common/Badge'

interface OrderStatusBadgeProps {
  status: OrderStatus
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
  const tone =
    status === 'completed'
      ? 'success'
      : status === 'cancelled'
        ? 'danger'
        : status === 'new'
          ? 'info'
          : 'warning'

  return <Badge tone={tone}>{status}</Badge>
}
