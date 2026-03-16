import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer } from '../../components/common/Drawer'
import { Button } from '../../components/common/Button'
import { Skeleton } from '../../components/common/Skeleton'
import { StatCard } from '../../components/app/StatCard'
import { useApp } from '../../context/AppContext'
import { api } from '../../services/api'
import type { AuditLogEntry } from '../../types'
import { formatCurrency, formatDateTime } from '../../utils/format'

export const DashboardPage = () => {
  const {
    state: { orders, agents, checklist, user },
    stats,
    markChecklist,
    openShopifyModal,
    appLoading,
  } = useApp()

  const [activityDrawer, setActivityDrawer] = useState(false)
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const completion = useMemo(
    () => Math.round((Object.values(checklist).filter(Boolean).length / Object.values(checklist).length) * 100),
    [checklist],
  )

  const checklistRows: { key: keyof typeof checklist; label: string }[] = [
    { key: 'completeProfile', label: 'Complete profile' },
    { key: 'addFirstProduct', label: 'Add first product' },
    { key: 'createFirstAgent', label: 'Create first agent' },
    { key: 'configureWebhook', label: 'Configure webhook' },
    { key: 'activateAgent', label: 'Activate agent' },
  ]

  const recentOrders = orders.slice(0, 5)
  const canViewAudit = user?.role === 'owner' || user?.role === 'admin'

  useEffect(() => {
    if (!canViewAudit) return

    let active = true
    const loadAuditLogs = async () => {
      setAuditLoading(true)
      try {
        const result = await api.audit.listRecent({ limit: 8 })
        if (active) {
          setAuditLogs(result.logs)
        }
      } catch {
        if (active) {
          setAuditLogs([])
        }
      } finally {
        if (active) {
          setAuditLoading(false)
        }
      }
    }

    void loadAuditLogs()

    return () => {
      active = false
    }
  }, [canViewAudit])

  const formatAuditAction = (action: string) => action.split('.').join(' ').replace(/_/g, ' ')

  return (
    <div className="stack-lg">
      <section className="split-row card">
        <div>
          <h1>Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'}.</h1>
          <p>Monitor active agents, order flow, and setup progress from one place.</p>
        </div>
        <div className="row gap-sm">
          <Link to="/app/products/new">
            <Button>Add Product</Button>
          </Link>
          <Link to="/app/agents/new">
            <Button variant="secondary">Create Agent</Button>
          </Link>
        </div>
      </section>

      <section className="grid four-col">
        <StatCard label="Total Products" value={stats.totalProducts} trend="+3 this week" />
        <StatCard label="Active Agents" value={stats.activeAgents} trend="2 currently live" />
        <StatCard label="Orders Today" value={stats.ordersToday} trend="+12% vs yesterday" />
        <StatCard label="Total Orders" value={stats.totalOrders} trend="Steady growth" />
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <div className="split-row">
            <h2>Onboarding checklist</h2>
            <strong>{completion}% complete</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${completion}%` }} />
          </div>
          {checklistRows.map((item) => (
            <label key={item.key} className="selector-item">
              <input
                type="checkbox"
                checked={checklist[item.key]}
                onChange={() => markChecklist(item.key)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </article>

        <article className="card stack-sm">
          <div className="split-row">
            <h2>Orders analytics widget</h2>
            <button className="text-btn" onClick={() => setActivityDrawer(true)}>
              View live feed
            </button>
          </div>
          <div className="chart-bars">
            {[35, 48, 42, 60, 55, 67, 51].map((value, index) => (
              <span key={`bar-${index}`} style={{ height: `${value}%` }} />
            ))}
          </div>
          <div className="grid three-col">
            <div className="mini-stat">
              <p>Top agent</p>
              <strong>{agents[0]?.name ?? 'N/A'}</strong>
            </div>
            <div className="mini-stat">
              <p>Best source</p>
              <strong>Mic UI</strong>
            </div>
            <div className="mini-stat">
              <p>Completion rate</p>
              <strong>94%</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <div className="split-row">
            <h2>Recent orders</h2>
            <Link to="/app/orders" className="text-link">
              View all
            </Link>
          </div>
          {appLoading ? (
            <div className="stack-sm">
              <Skeleton height={20} />
              <Skeleton height={20} />
              <Skeleton height={20} />
            </div>
          ) : (
            <ul className="line-list">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <div className="split-row">
                    <div>
                      <strong>{order.orderName}</strong>
                      <p className="muted">
                        {order.customerName} - {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <strong>{formatCurrency(order.totalAmount)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card stack-sm">
          <h2>Quick actions</h2>
          <Link to="/app/tour" className="action-card">
            Product tour
          </Link>
          <Link to="/app/agents/new" className="action-card">
            Configure backup order-taking agent
          </Link>
          <button className="action-card" onClick={openShopifyModal}>
            Connect Shopify (Coming Soon)
          </button>
          <div className="card muted-card">
            <h3>Shopify sync arriving soon</h3>
            <p>Join waitlist to get early access once catalog sync is available.</p>
            <Button variant="secondary" onClick={openShopifyModal}>
              Join waitlist
            </Button>
          </div>
        </article>
      </section>

      <section className={`grid ${canViewAudit ? 'two-col audit-grid' : 'three-col'}`}>
        {canViewAudit ? (
          <article className="card stack-sm">
            <div className="split-row">
              <div>
                <h3>Audit trail</h3>
                <p className="muted">Recent admin and security events across this workspace.</p>
              </div>
              <Button variant="ghost" onClick={() => setAuditDrawerOpen(true)}>
                View full log
              </Button>
            </div>
            {auditLoading ? (
              <div className="stack-sm">
                <Skeleton height={18} />
                <Skeleton height={18} />
                <Skeleton height={18} />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="audit-empty">
                <p className="muted">Audit events will appear here as admins change settings and agents.</p>
              </div>
            ) : (
              <ul className="line-list">
                {auditLogs.slice(0, 4).map((entry) => (
                  <li key={entry.id}>
                    <div className="split-row">
                      <div className="stack-sm">
                        <strong className="text-capitalize">{formatAuditAction(entry.action)}</strong>
                        <p className="muted">
                          {entry.actorEmail ?? 'System'} · {entry.entityType}
                        </p>
                      </div>
                      <span className="muted">{formatDateTime(entry.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : null}

        <article className="card">
          <h3>Live activity</h3>
          <p>Agent "Night Shift Assistant" captured a new order 4 mins ago.</p>
        </article>
        <article className="card">
          <h3>Webhook health</h3>
          <p>Last 50 deliveries successful. No retry needed.</p>
        </article>
        <article className="card">
          <h3>Next best step</h3>
          <p>Create a second script-mode agent for your website checkout page.</p>
        </article>
      </section>

      <Drawer open={activityDrawer} onClose={() => setActivityDrawer(false)} title="Recent activity">
        <ul className="line-list">
          <li>Agent Night Shift Assistant captured ORD-10091.</li>
          <li>Webhook delivered to /orders/new endpoint.</li>
          <li>Catalog Web Agent paused by admin.</li>
          <li>Product "Vanilla Syrup" updated to draft status.</li>
        </ul>
      </Drawer>

      <Drawer open={auditDrawerOpen} onClose={() => setAuditDrawerOpen(false)} title="Workspace audit trail">
        {auditLoading ? (
          <div className="stack-sm">
            <Skeleton height={18} />
            <Skeleton height={18} />
            <Skeleton height={18} />
          </div>
        ) : (
          <ul className="line-list">
            {auditLogs.map((entry) => (
              <li key={entry.id}>
                <div className="stack-sm">
                  <div className="split-row">
                    <strong className="text-capitalize">{formatAuditAction(entry.action)}</strong>
                    <span className="muted">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="muted">
                    {entry.actorEmail ?? 'System'} · {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  )
}
