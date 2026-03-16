import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentCard } from '../../components/app/AgentCard'
import { DeleteConfirmModal } from '../../components/app/DeleteConfirmModal'
import { Button } from '../../components/common/Button'
import { useApp } from '../../context/AppContext'
import { formatDateTime } from '../../utils/format'
import { AGENT_TYPE_LABELS } from '../../constants/agentTypes'

export const AgentsPage = () => {
  const {
    state: { agents, products },
    toggleAgent,
    deleteAgent,
  } = useApp()

  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [mode, setMode] = useState('all')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const next = agents
      .filter((agent) => agent.name.toLowerCase().includes(query.toLowerCase()))
      .filter((agent) => (status === 'all' ? true : status === 'active' ? agent.isActive : !agent.isActive))
      .filter((agent) => (mode === 'all' ? true : agent.mode === mode))

    return [...next].sort((a, b) =>
      sort === 'newest'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }, [agents, query, status, mode, sort])

  const productCountLabel = (ids: string[]) => `${ids.length} selected product${ids.length === 1 ? '' : 's'}`
  const activeAgents = useMemo(() => agents.filter((agent) => agent.isActive).length, [agents])
  const scriptAgents = useMemo(() => agents.filter((agent) => agent.mode === 'script').length, [agents])
  const webhookReady = useMemo(() => agents.filter((agent) => agent.webhookStatus === 'connected').length, [agents])
  const totalOrdersHandled = useMemo(() => agents.reduce((sum, agent) => sum + agent.ordersHandled, 0), [agents])

  return (
    <div className="stack-lg">
      <section className="card agents-hero">
        <div className="split-row">
          <div className="stack-sm">
            <span className="section-kicker">Agent Operations</span>
            <h1>Agents</h1>
            <p className="muted agents-hero-copy">
              Manage the AI order-taking agents your business uses when human staff are unavailable. Control channels,
              product access, webhook routing, and activation from one place.
            </p>
          </div>
          <div className="row gap-sm wrap">
            <Button onClick={() => navigate('/app/agents/new')}>Create Agent</Button>
          </div>
        </div>
        <div className="agents-kpi-grid">
          <article className="agents-kpi-card">
            <span>Total agents</span>
            <strong>{agents.length}</strong>
            <p>{filtered.length} visible with current filters</p>
          </article>
          <article className="agents-kpi-card">
            <span>Active now</span>
            <strong>{activeAgents}</strong>
            <p>Ready to capture orders live</p>
          </article>
          <article className="agents-kpi-card">
            <span>Script mode</span>
            <strong>{scriptAgents}</strong>
            <p>Configured for embedded experiences</p>
          </article>
          <article className="agents-kpi-card">
            <span>Orders handled</span>
            <strong>{totalOrdersHandled}</strong>
            <p>{webhookReady} with healthy webhook delivery</p>
          </article>
        </div>
      </section>

      <section className="card agents-controls">
        <div className="agents-controls-top">
          <div className="agents-search-shell">
            <input
              className="input"
              placeholder="Search by agent name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <p className="muted">Filter by status, operating mode, or recency before you switch agents on or off.</p>
          </div>
          <div className="agents-view-switch">
            <Button size="sm" variant={view === 'grid' ? 'primary' : 'secondary'} onClick={() => setView('grid')}>
              Grid
            </Button>
            <Button size="sm" variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>
              List
            </Button>
          </div>
        </div>
        <div className="agents-filter-grid">
          <label className="agents-filter">
            <span>Status</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="agents-filter">
            <span>Mode</span>
            <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="all">All modes</option>
              <option value="mic">Mic UI</option>
              <option value="script">Script</option>
            </select>
          </label>
          <label className="agents-filter">
            <span>Sort by</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>
      </section>

      {products.length === 0 ? (
        <section className="card agents-warning-banner">
          <div>
            <strong>Create products before assigning them to an agent.</strong>
            <p className="muted">Your catalog needs at least one product before an agent can take accurate orders.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/app/products/new')}>
            Add product first
          </Button>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <section className="card agents-empty-state">
          <div className="agents-empty-body">
            <div className="stack-sm">
              <span className="section-kicker">Fallback automation</span>
              <h2>No agents yet</h2>
              <p className="muted">
                Create your first order-taking agent to cover temporary staffing gaps, route orders to your systems,
                and keep business running when human order takers step away.
              </p>
              <div className="agents-empty-actions">
                <Button onClick={() => navigate('/app/agents/new')}>Create first agent</Button>
                <Button variant="secondary" onClick={() => navigate('/app/products')}>
                  Review products
                </Button>
              </div>
            </div>
            <div className="agents-empty-checklist">
              <div>
                <strong>Recommended launch checklist</strong>
                <p>Make sure the first agent has everything needed before you enable it for live order handling.</p>
              </div>
              <ul>
                <li>Choose mic UI or script mode</li>
                <li>Assign all products or a curated subset</li>
                <li>Configure webhook notifications for downstream systems</li>
              </ul>
            </div>
          </div>
        </section>
      ) : view === 'grid' ? (
        <section className="grid two-col">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              productCountLabel={productCountLabel(agent.productIds)}
              onToggle={toggleAgent}
              onView={(id) => navigate(`/app/agents/${id}`)}
              onStart={(id) => navigate(`/app/agents/${id}/live`)}
              onEdit={(id) => navigate(`/app/agents/${id}/edit`)}
              onDelete={setDeleteId}
            />
          ))}
        </section>
      ) : (
        <section className="card agents-list-surface">
          {filtered.map((agent) => (
            <div className="list-row agent-list-row" key={agent.id}>
              <div className="agent-list-summary">
                <div className={`agent-list-avatar ${agent.isActive ? 'active' : 'inactive'}`}>{agent.name.slice(0, 1)}</div>
                <div>
                  <strong>{agent.name}</strong>
                  <p className="muted">
                    {AGENT_TYPE_LABELS[agent.agentType]} · {agent.mode === 'mic' ? 'Mic UI' : 'Script'} ·{' '}
                    {agent.isActive ? 'Active' : 'Inactive'} · Last active {formatDateTime(agent.lastActivity)}
                  </p>
                </div>
              </div>
              <div className="row gap-sm">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/app/agents/${agent.id}`)}>
                  View
                </Button>
                {agent.agentType === 'terminal' ? (
                  <Button size="sm" onClick={() => navigate(`/app/agents/${agent.id}/live`)}>
                    Start Agent
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => navigate(`/app/agents/${agent.id}/edit`)}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <DeleteConfirmModal
        open={Boolean(deleteId)}
        description="Deleting an agent removes it from future order routing."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return
          await deleteAgent(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
