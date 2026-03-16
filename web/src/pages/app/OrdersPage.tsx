import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/app/EmptyState'
import { OrderTable } from '../../components/app/OrderTable'
import { Button } from '../../components/common/Button'
import { Skeleton } from '../../components/common/Skeleton'
import { OrderStatusBadge } from '../../components/app/OrderStatusBadge'
import { useApp } from '../../context/AppContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { api, ApiClientError } from '../../services/api'
import { formatCurrency, formatDateTime, humanizeSource } from '../../utils/format'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

export const OrdersPage = () => {
  const {
    state: { orders, agents },
    pushToast,
  } = useApp()

  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [agent, setAgent] = useState('all')
  const [sort, setSort] = useState('newest')
  const [source, setSource] = useState('all')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [paginatedOrders, setPaginatedOrders] = useState<typeof orders>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<number>(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const totalOrders = useMemo(() => orders.length, [orders])
  const debouncedQuery = useDebouncedValue(query)
  const ordersToday = useMemo(() => {
    const today = new Date().toDateString()
    return orders.filter((order) => new Date(order.createdAt).toDateString() === today).length
  }, [orders])
  const activeOrders = useMemo(
    () => orders.filter((order) => ['new', 'confirmed', 'processing'].includes(order.status)).length,
    [orders],
  )
  const completedOrders = useMemo(() => orders.filter((order) => order.status === 'completed').length, [orders])
  const grossRevenue = useMemo(() => orders.reduce((sum, order) => sum + order.totalAmount, 0), [orders])

  const fetchOrders = useCallback(
    async (targetPage: number) => {
      setListLoading(true)
      setListError(null)
      try {
        const result = await api.orders.list({
          page: targetPage,
          limit,
          q: debouncedQuery.trim() || undefined,
          status:
            status === 'all'
              ? undefined
              : (status as 'new' | 'confirmed' | 'processing' | 'completed' | 'cancelled'),
          source: source === 'all' ? undefined : (source as 'mic' | 'script' | 'human' | 'webhook'),
          agentId: agent === 'all' ? undefined : agent,
          sort: sort as 'newest' | 'oldest'
        })

        const resolvedTotal = result.total ?? result.orders.length
        const resolvedTotalPages = Math.max((result.totalPages ?? Math.ceil(resolvedTotal / limit)) || 1, 1)

        if (targetPage > resolvedTotalPages && resolvedTotal > 0) {
          setPage(resolvedTotalPages)
          return
        }

        setPaginatedOrders(result.orders)
        setTotal(resolvedTotal)
        setTotalPages(resolvedTotalPages)
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : 'Unable to load orders right now. Please try again.'
        setListError(message)
      } finally {
        setListLoading(false)
      }
    },
    [limit, debouncedQuery, status, source, agent, sort]
  )

  useEffect(() => {
    void fetchOrders(page)
  }, [fetchOrders, page])

  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    }
  }, [debouncedQuery, status, source, agent, sort, limit, page])

  return (
    <div className="stack-lg">
      <section className="card orders-hero">
        <div className="split-row">
          <div className="stack-sm">
            <span className="section-kicker">Order Operations</span>
          <h1>Orders</h1>
            <p className="muted orders-hero-copy">
              Track every order in one place with clear source, assigned agent, timeline, and fulfillment status.
            </p>
          </div>
          <div className="row gap-sm wrap">
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({
                  type: 'success',
                  title: 'Export started',
                  message: 'This is a placeholder. CSV export wiring can be connected to backend later.',
                })
              }
            >
              Export Orders
            </Button>
          </div>
        </div>
        <div className="orders-kpi-grid">
          <article className="orders-kpi-card">
            <span>Total orders</span>
            <strong>{totalOrders}</strong>
            <p>{total} matching current filters</p>
          </article>
          <article className="orders-kpi-card">
            <span>Orders today</span>
            <strong>{ordersToday}</strong>
            <p>Captured in the last 24 hours</p>
          </article>
          <article className="orders-kpi-card">
            <span>In progress</span>
            <strong>{activeOrders}</strong>
            <p>New, confirmed, or processing</p>
          </article>
          <article className="orders-kpi-card">
            <span>Completed</span>
            <strong>{completedOrders}</strong>
            <p>Closed successfully</p>
          </article>
          <article className="orders-kpi-card">
            <span>Gross revenue</span>
            <strong>{formatCurrency(grossRevenue)}</strong>
            <p>Total order value</p>
          </article>
        </div>
      </section>

      <section className="card orders-controls">
        <div className="orders-controls-top">
          <div className="orders-search-shell">
            <input
              className="input"
              placeholder="Search by order ID, customer, or agent"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <p className="muted">Refine by status, source, and assigned agent to review order flow quickly.</p>
          </div>
          <div className="orders-view-switch">
            <Button size="sm" variant={view === 'table' ? 'primary' : 'secondary'} onClick={() => setView('table')}>
              Table
            </Button>
            <Button size="sm" variant={view === 'card' ? 'primary' : 'secondary'} onClick={() => setView('card')}>
              Cards
            </Button>
          </div>
        </div>

        <div className="orders-filter-grid">
          <label className="orders-filter">
            <span>Status</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All status</option>
              <option value="new">New</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="orders-filter">
            <span>Agent</span>
            <select className="input" value={agent} onChange={(event) => setAgent(event.target.value)}>
              <option value="all">All agents</option>
              {agents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="orders-filter">
            <span>Source</span>
            <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="all">All sources</option>
              <option value="mic">Mic UI</option>
              <option value="script">Embedded Script</option>
              <option value="human">Human Assisted</option>
              <option value="webhook">Webhook Origin</option>
            </select>
          </label>
          <label className="orders-filter">
            <span>Sort by</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </section>

      {listError ? (
        <section className="card">
          <p className="muted">{listError}</p>
        </section>
      ) : listLoading ? (
        <div className="stack-sm">
          <Skeleton height={24} />
          <Skeleton height={24} />
          <Skeleton height={24} />
        </div>
      ) : paginatedOrders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={query || status !== 'all' || agent !== 'all' || source !== 'all'
            ? 'Try adjusting filters to see more results.'
            : 'New captured orders will appear here.'}
        />
      ) : view === 'table' ? (
        <OrderTable orders={paginatedOrders} onView={(id) => navigate(`/app/orders/${id}`)} />
      ) : (
        <section className="grid two-col">
          {paginatedOrders.map((order) => (
            <article className="card order-list-card" key={order.id}>
              <div className="order-list-card-head">
                <div className="stack-xs">
                  <strong>{order.orderName}</strong>
                  <span className="muted">Internal ID: {order.id}</span>
                  <span className="muted">{formatDateTime(order.createdAt)}</span>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="order-list-card-body">
                <div>
                  <p className="muted">Customer</p>
                  <strong>{order.customerName}</strong>
                </div>
                <div>
                  <p className="muted">Items</p>
                  <strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                </div>
                <div>
                  <p className="muted">Source</p>
                  <strong>{humanizeSource(order.source)}</strong>
                </div>
                <div>
                  <p className="muted">Total</p>
                  <strong>{formatCurrency(order.totalAmount)}</strong>
                </div>
              </div>
              <p className="muted order-list-card-items">
                {order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}
              </p>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/app/orders/${order.id}`)}>
                View details
              </Button>
            </article>
          ))}
        </section>
      )}

      {!listLoading && total > 0 ? (
        <section className="card">
          <div className="split-row">
            <p className="muted">
              Page {page} of {totalPages} • {total} order{total === 1 ? '' : 's'}
            </p>
            <div className="row gap-sm wrap">
              <label className="row gap-xs">
                <span className="muted">Per page</span>
                <select className="input" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="ghost" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
