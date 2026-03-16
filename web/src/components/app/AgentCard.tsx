import type { Agent } from '../../types'
import { formatDateTime } from '../../utils/format'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Dropdown } from '../common/Dropdown'
import { ToggleSwitch } from '../common/ToggleSwitch'
import { AGENT_TYPE_LABELS } from '../../constants/agentTypes'

interface AgentCardProps {
  agent: Agent
  productCountLabel: string
  onToggle: (id: string, active: boolean) => void
  onView: (id: string) => void
  onStart: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const AgentCard = ({
  agent,
  productCountLabel,
  onToggle,
  onView,
  onStart,
  onEdit,
  onDelete,
}: AgentCardProps) => (
  <article className={`card agent-card ${agent.isActive ? '' : 'muted-card'}`}>
    <div className="agent-card-topline">
      <div className={`agent-card-avatar ${agent.isActive ? 'active' : 'inactive'}`}>{agent.name.slice(0, 1)}</div>
      <div className="agent-card-topline-meta">
        <span>{AGENT_TYPE_LABELS[agent.agentType]}</span>
        <span>{agent.productAccess === 'all' ? 'All catalog access' : productCountLabel}</span>
      </div>
    </div>
    <div className="split-row">
      <div>
        <h3>{agent.name}</h3>
        <p className="muted">{agent.description || 'No description provided.'}</p>
      </div>
      <Badge tone={agent.isActive ? 'success' : 'warning'}>{agent.isActive ? 'Active' : 'Inactive'}</Badge>
    </div>

    <div className="agent-grid">
      <div>
        <p className="muted">Product access</p>
        <strong>{agent.productAccess === 'all' ? 'All products' : productCountLabel}</strong>
      </div>
      <div>
        <p className="muted">Webhook</p>
        <strong>{agent.webhookStatus.replace('_', ' ')}</strong>
      </div>
      <div>
        <p className="muted">Mode</p>
        <strong>{agent.mode === 'mic' ? 'Mic UI' : 'Script'}</strong>
      </div>
      <div>
        <p className="muted">Category</p>
        <strong>{AGENT_TYPE_LABELS[agent.agentType]}</strong>
      </div>
      <div>
        <p className="muted">Orders handled</p>
        <strong>{agent.ordersHandled}</strong>
      </div>
    </div>

    <div className="split-row">
      <p className="muted">Last activity: {formatDateTime(agent.lastActivity)}</p>
      <ToggleSwitch
        checked={agent.isActive}
        onChange={(checked) => onToggle(agent.id, checked)}
        label={agent.isActive ? 'On' : 'Off'}
      />
    </div>

    <div className="split-row">
      <div className="row gap-xs">
        <Button variant="ghost" size="sm" onClick={() => onView(agent.id)}>
          View
        </Button>
        {agent.agentType === 'terminal' ? (
          <Button size="sm" onClick={() => onStart(agent.id)}>
            Start Agent
          </Button>
        ) : null}
      </div>
      <Dropdown
        label="Actions"
        items={[
          { label: 'Edit', onClick: () => onEdit(agent.id) },
          { label: 'Delete', onClick: () => onDelete(agent.id), danger: true },
        ]}
      />
    </div>
  </article>
)
