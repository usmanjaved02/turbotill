import { Navigate, useParams } from 'react-router-dom'
import { OrderStatusBadge } from '../../components/app/OrderStatusBadge'
import { useApp, useOrderById } from '../../context/AppContext'
import { formatCurrency, formatDateTime, humanizeSource } from '../../utils/format'

export const OrderDetailPage = () => {
  const { id } = useParams()
  const { updateOrderStatus } = useApp()
  const order = useOrderById(id)

  if (!order) return <Navigate to="/app/orders" replace />

  return (
    <div className="stack-lg">
      <section className="split-row">
        <div>
          <h1>{order.orderName}</h1>
          <p className="muted">Internal ID: {order.id}</p>
          <p className="muted">{formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Order summary</h3>
          <p>
            <span className="muted">Order number:</span> {order.orderName}
          </p>
          <p>
            <span className="muted">Customer:</span> {order.customerName}
          </p>
          <p>
            <span className="muted">Source:</span> {humanizeSource(order.source)}
          </p>
          <p>
            <span className="muted">Assigned agent:</span> {order.agentName ?? 'Unassigned'}
          </p>
          <p>
            <span className="muted">Total:</span> {formatCurrency(order.totalAmount)}
          </p>
        </article>

        <article className="card stack-sm">
          <h3>Customer information</h3>
          <p>{order.customerName}</p>
          <p>{order.customerPhone}</p>
          <p>{order.customerEmail}</p>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Ordered items</h3>
          <ul className="line-list">
            {order.items.map((item) => (
              <li key={item.productId}>
                {item.productName} x{item.quantity} - {formatCurrency(item.unitPrice)}
              </li>
            ))}
          </ul>
        </article>

        <article className="card stack-sm">
          <h3>Status change</h3>
          <select
            className="input"
            value={order.status}
            onChange={(event) => updateOrderStatus(order.id, event.target.value as typeof order.status)}
          >
            <option value="new">New</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <p>
            <span className="muted">Webhook delivery:</span>{' '}
            {order.webhookDelivered ? 'Delivered successfully' : 'Pending / failed'}
          </p>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Notes</h3>
          <p>{order.notes || 'No notes for this order.'}</p>
        </article>

        <article className="card stack-sm">
          <h3>Activity log / Timeline</h3>
          <ul className="line-list">
            {order.timeline.map((entry) => (
              <li key={`${entry.label}-${entry.at}`}>
                <strong>{entry.label}</strong>
                <p className="muted">{formatDateTime(entry.at)}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  )
}
