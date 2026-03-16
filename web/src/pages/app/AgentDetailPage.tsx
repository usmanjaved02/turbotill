import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Tabs } from '../../components/common/Tabs'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { ToggleSwitch } from '../../components/common/ToggleSwitch'
import { MicPreview } from '../../components/app/MicPreview'
import { ScriptEmbedCard } from '../../components/app/ScriptEmbedCard'
import { useApp } from '../../context/AppContext'
import { formatDateTime } from '../../utils/format'
import { AGENT_TYPE_LABELS } from '../../constants/agentTypes'

export const AgentDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    state: { agents, products, orders },
    toggleAgent,
  } = useApp()

  const agent = agents.find((item) => item.id === id)
  if (!agent) return <Navigate to="/app/agents" replace />

  const assignedProducts =
    agent.productAccess === 'all' ? products : products.filter((product) => agent.productIds.includes(product.id))
  const recentOrders = orders.filter((order) => order.agentId === agent.id).slice(0, 5)
  const tableOrderLink = useMemo(() => {
    if (agent.agentType !== 'table_order_taker') {
      return ''
    }

    if (!agent.tableConfig?.defaultTableNumber) {
      return ''
    }

    const baseUrl = agent.tableConfig.customerEntryUrl || `${window.location.origin}/table-order`

    try {
      const url = new URL(baseUrl)
      url.searchParams.set('agentId', agent.id)
      url.searchParams.set('table', agent.tableConfig.defaultTableNumber)
      return url.toString()
    } catch {
      return ''
    }
  }, [agent.agentType, agent.id, agent.tableConfig?.customerEntryUrl, agent.tableConfig?.defaultTableNumber])
  const tableQrImage = tableOrderLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tableOrderLink)}`
    : ''

  return (
    <div className="stack-lg">
      <section className="split-row card">
        <div>
          <h1>{agent.name}</h1>
          <p>{agent.description || 'No description provided.'}</p>
        </div>
        <div className="row gap-sm">
          <Button onClick={() => navigate(`/app/agents/${agent.id}/live`)}>Start Agent</Button>
          <ToggleSwitch checked={agent.isActive} onChange={(checked) => toggleAgent(agent.id, checked)} />
          <Button variant="secondary" onClick={() => navigate(`/app/agents/${agent.id}/edit`)}>
            Edit agent
          </Button>
        </div>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Basic info</h3>
          <p>
            <span className="muted">Status:</span>{' '}
            <Badge tone={agent.isActive ? 'success' : 'warning'}>{agent.isActive ? 'Active' : 'Paused'}</Badge>
          </p>
          <p>
            <span className="muted">Category:</span> {AGENT_TYPE_LABELS[agent.agentType]}
          </p>
          <p>
            <span className="muted">Mode:</span> {agent.mode === 'mic' ? 'Mic UI' : 'Script'}
          </p>
          <p>
            <span className="muted">Last activity:</span> {formatDateTime(agent.lastActivity)}
          </p>
          <p>
            <span className="muted">Orders handled:</span> {agent.ordersHandled}
          </p>
        </article>

        <article className="card stack-sm">
          <h3>Product access</h3>
          <p>{agent.productAccess === 'all' ? 'All products' : 'Selected products only'}</p>
          {agent.agentType === 'table_order_taker' ? (
            <p className="muted">
              Table orders: {agent.tableConfig?.allowMultipleOrdersPerTable === false ? 'Single active order per table' : 'Multiple active orders allowed'}
            </p>
          ) : null}
          <ul className="line-list">
            {assignedProducts.map((product) => (
              <li key={product.id}>{product.name}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Webhook details</h3>
          <p>
            <span className="muted">URL:</span> {agent.webhookUrl || 'Not configured'}
          </p>
          <p>
            <span className="muted">Status:</span> {agent.webhookStatus.replace('_', ' ')}
          </p>
        </article>

        <article className="card stack-sm">
          <h3>Recent orders handled by this agent</h3>
          {recentOrders.length === 0 ? (
            <p className="muted">No recent orders.</p>
          ) : (
            <ul className="line-list">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  {order.orderName} - {order.customerName}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {agent.agentType === 'table_order_taker' ? (
        <section className="card stack-sm">
          <h3>Table QR</h3>
          {tableOrderLink ? (
            <div className="agent-qr-shell">
              <img src={tableQrImage} alt={`Table QR for ${agent.tableConfig?.defaultTableNumber ?? 'table'}`} className="agent-qr-image" />
              <div className="stack-xs">
                <strong>Scan URL</strong>
                <code className="agent-qr-link">{tableOrderLink}</code>
                <a href={tableOrderLink} target="_blank" rel="noreferrer" className="text-link">
                  Open link
                </a>
              </div>
            </div>
          ) : (
            <p className="muted">Set a default table number in edit mode to generate QR for customers.</p>
          )}
        </section>
      ) : null}

      <section>
        <Tabs
          activeKey={agent.mode}
          onChange={() => null}
          tabs={[
            {
              key: 'mic',
              label: 'Mic UI',
              content: <MicPreview />,
            },
            {
              key: 'script',
              label: 'Script Embed',
              content: <ScriptEmbedCard code={agent.embedCode} onRegenerate={() => null} />,
            },
          ]}
        />
      </section>
    </div>
  )
}
