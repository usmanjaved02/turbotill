import type { Order } from '../../types'
import { formatCurrency, formatDateTime, humanizeSource } from '../../utils/format'
import { Button } from '../common/Button'
import { OrderStatusBadge } from './OrderStatusBadge'

interface OrderTableProps {
  orders: Order[]
  onView: (id: string) => void
}

export const OrderTable = ({ orders, onView }: OrderTableProps) => (
  <div className="table-wrap card orders-table-wrap">
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Items</th>
          <th>Channel</th>
          <th>Agent</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Placed at</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>
              <div className="order-table-order">
                <strong>{order.orderName}</strong>
                <span>Internal ID: {order.id}</span>
                <span>{order.items.length} line item{order.items.length === 1 ? '' : 's'}</span>
              </div>
            </td>
            <td>
              <div className="order-table-customer">
                <strong>{order.customerName}</strong>
                {order.customerPhone ? <span>{order.customerPhone}</span> : null}
              </div>
            </td>
            <td>
              <div className="order-table-items">
                <strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)} pcs</strong>
                <span>{order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}</span>
              </div>
            </td>
            <td>{humanizeSource(order.source)}</td>
            <td>{order.agentName ?? 'Unassigned'}</td>
            <td>
              <strong>{formatCurrency(order.totalAmount)}</strong>
            </td>
            <td>
              <OrderStatusBadge status={order.status} />
            </td>
            <td>{formatDateTime(order.createdAt)}</td>
            <td>
              <Button size="sm" variant="ghost" onClick={() => onView(order.id)}>
                View
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
