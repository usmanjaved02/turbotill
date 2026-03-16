import type { Agent } from '../../types'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'

interface WebhookConfigCardProps {
  webhookUrl: string
  webhookSecret: string
  status: Agent['webhookStatus']
  onUrlChange: (url: string) => void
  onSecretChange: (secret: string) => void
  onTest: () => void
  isTesting?: boolean
  embedded?: boolean
}

export const WebhookConfigCard = ({
  webhookUrl,
  webhookSecret,
  status,
  onUrlChange,
  onSecretChange,
  onTest,
  isTesting,
  embedded = false,
}: WebhookConfigCardProps) => (
  <section className={embedded ? 'stack-sm agent-embedded-block' : 'card stack-sm'}>
    <div className="split-row">
      <h3>Webhook Configuration</h3>
      <Badge tone={status === 'connected' ? 'success' : status === 'failed' ? 'danger' : 'warning'}>
        {status.replace('_', ' ')}
      </Badge>
    </div>
    <p className="muted">
      Send order creation notifications to your external systems in real time.
    </p>
    <input
      className="input"
      placeholder="https://your-system.com/orders/webhook"
      value={webhookUrl}
      onChange={(event) => onUrlChange(event.target.value)}
    />
    <input
      className="input"
      placeholder="Optional secret key/token"
      value={webhookSecret}
      onChange={(event) => onSecretChange(event.target.value)}
    />
    <div className="row gap-sm">
      <Button type="button" variant="secondary" onClick={onTest} disabled={isTesting}>
        {isTesting ? 'Testing...' : 'Test webhook'}
      </Button>
      <span className="muted">We send a mock order payload to validate integration.</span>
    </div>
  </section>
)
