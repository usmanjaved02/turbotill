import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { PlayIcon, StopIcon } from '../../components/common/Icons'
import { Reveal } from '../../components/common/Reveal'
import { formatCurrency } from '../../utils/format'
import type { AgentType } from '../../types'
import { AGENT_TYPE_LABELS } from '../../constants/agentTypes'

const steps = [
  {
    title: 'Pick an agent category',
    summary: 'Choose Terminal Agent, Table Order Taker, or WhatsApp Call Attendant (coming soon).',
    output: 'Channel-specific order workflow',
  },
  {
    title: 'Set agent profile',
    summary: 'Add a clear name and instructions so the agent follows your service style.',
    output: 'Consistent agent behavior',
  },
  {
    title: 'Select voice language and preset',
    summary: 'Pick language and voice preset, then test preview before going live.',
    output: 'Brand-ready voice identity',
  },
  {
    title: 'Configure product access',
    summary: 'Allow all products or assign only selected products for tighter control.',
    output: 'Controlled order scope',
  },
  {
    title: 'Set webhook endpoint',
    summary: 'Connect Turbo Till with ERP/CRM/fulfillment using full order payload structure.',
    output: 'Real-time system sync',
  },
  {
    title: 'Configure channel behavior',
    summary: 'Terminal agents run for desk flows, while table agents generate QR/table occupancy rules.',
    output: 'Category-specific setup complete',
  },
  {
    title: 'Activate and monitor',
    summary: 'Start with safe activation controls and monitor live order traffic in dashboard.',
    output: 'Controlled go-live',
  },
  {
    title: 'Capture, confirm, and deliver',
    summary: 'Agent confirms order with total, creates order ID, and sends webhook instantly.',
    output: 'Complete auditable order lifecycle',
  },
]

export const HowItWorksPage = () => {
  const [activeStep, setActiveStep] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [agentPath, setAgentPath] = useState<AgentType>('terminal')
  const [coverageHours, setCoverageHours] = useState(2)
  const [ordersPerHour, setOrdersPerHour] = useState(4)
  const [avgOrderValue, setAvgOrderValue] = useState(42)

  useEffect(() => {
    if (!autoPlay) return
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, 1700)
    return () => clearInterval(timer)
  }, [autoPlay])

  const progress = Math.round(((activeStep + 1) / steps.length) * 100)
  const current = steps[activeStep]

  const impact = useMemo(() => {
    const recoverableOrders = coverageHours * ordersPerHour
    const recoverableRevenue = recoverableOrders * avgOrderValue
    return { recoverableOrders, recoverableRevenue }
  }, [coverageHours, ordersPerHour, avgOrderValue])

  const pathPreview: Record<AgentType, { title: string; points: string[] }> = {
    terminal: {
      title: `${AGENT_TYPE_LABELS.terminal} flow`,
      points: [
        'Internal desk/operator starts intake from the Turbo Till console.',
        'Agent captures customer request and confirms items with order total.',
        'Order is created with company-specific unique order ID and webhook payload.',
      ],
    },
    table_order_taker: {
      title: `${AGENT_TYPE_LABELS.table_order_taker} flow`,
      points: [
        'Customer scans table QR link and opens mobile-first voice ordering page.',
        'Agent handles real-time table conversation with table occupancy rules.',
        'Order is placed against table number and synced to dashboard/webhook.',
      ],
    },
    whatsapp_call_attendant: {
      title: `${AGENT_TYPE_LABELS.whatsapp_call_attendant} flow`,
      points: [
        'Incoming WhatsApp voice call will connect to configured agent profile.',
        'Agent follows your instructions and product scope for structured orders.',
        'This category is marked coming soon and can be planned during setup.',
      ],
    },
  }

  const selectedPath = pathPreview[agentPath]

  return (
    <div className="stack-xl">
      <section>
        <span className="eyebrow">Workflow</span>
        <h1>From setup to live order capture in clear, guided steps</h1>
        <p>Use the interactive walkthrough to see exactly how order continuity is achieved.</p>
      </section>

      <Reveal>
        <section className="how-grid">
          <article className="card stack-sm">
            <div className="split-row">
              <h2>Interactive Step Walkthrough</h2>
              <Badge tone="info">{progress}% complete</Badge>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="row gap-sm">
              <Button size="sm" variant="secondary" onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}>
                Previous
              </Button>
              <Button size="sm" onClick={() => setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))}>
                Next
              </Button>
              <Button
                size="sm"
                variant={autoPlay ? 'danger' : 'ghost'}
                iconLeft={autoPlay ? <StopIcon /> : <PlayIcon />}
                onClick={() => setAutoPlay((prev) => !prev)}
              >
                {autoPlay ? 'Stop demo' : 'Auto-play demo'}
              </Button>
            </div>
            <div className="timeline interactive">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  className={`timeline-step card ${index === activeStep ? 'active' : ''}`}
                  onClick={() => setActiveStep(index)}
                >
                  <span className="timeline-index">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p className="muted">{step.summary}</p>
                  </div>
                </button>
              ))}
            </div>
          </article>

          <article className="card stack-sm workflow-detail-card">
            <div className="workflow-current-head">
              <span className="workflow-current-pill">Current Step</span>
              <span className="workflow-current-index">
                {activeStep + 1} / {steps.length}
              </span>
            </div>
            <h3>{current.title}</h3>
            <p>{current.summary}</p>
            <div className="workflow-output">
              <span className="muted">Output</span>
              <strong>{current.output}</strong>
            </div>
            <div className="workflow-events">
              <h4>System events</h4>
              <ul className="line-list">
                <li>Validation checks are applied before moving forward.</li>
                <li>Dashboard status updates instantly for your team.</li>
                <li>Every transition is trackable in activity logs.</li>
              </ul>
            </div>
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section className="grid two-col">
          <article className="card stack-sm">
            <h2>Category-specific flow</h2>
            <div className="row gap-sm">
              <Button
                size="sm"
                variant={agentPath === 'terminal' ? 'primary' : 'secondary'}
                onClick={() => setAgentPath('terminal')}
              >
                Terminal Agent
              </Button>
              <Button
                size="sm"
                variant={agentPath === 'table_order_taker' ? 'primary' : 'secondary'}
                onClick={() => setAgentPath('table_order_taker')}
              >
                Table Order Taker
              </Button>
              <Button
                size="sm"
                variant={agentPath === 'whatsapp_call_attendant' ? 'primary' : 'secondary'}
                onClick={() => setAgentPath('whatsapp_call_attendant')}
              >
                WhatsApp (Soon)
              </Button>
            </div>
            <div className="card mode-preview-card">
              <h3>{selectedPath.title}</h3>
              <ul className="line-list">
                {selectedPath.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card stack-sm">
            <h2>Coverage Impact Simulator</h2>
            <label>
              Staff unavailability hours
              <input
                className="input"
                type="range"
                min={1}
                max={12}
                value={coverageHours}
                onChange={(event) => setCoverageHours(Number(event.target.value))}
              />
              <span className="muted">{coverageHours} hours</span>
            </label>
            <label>
              Orders per hour
              <input
                className="input"
                type="range"
                min={1}
                max={20}
                value={ordersPerHour}
                onChange={(event) => setOrdersPerHour(Number(event.target.value))}
              />
              <span className="muted">{ordersPerHour} orders/hour</span>
            </label>
            <label>
              Average order value ($)
              <input
                className="input"
                type="number"
                min={1}
                value={avgOrderValue}
                onChange={(event) => setAvgOrderValue(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <div className="grid two-col">
              <div className="mini-stat">
                <p>Recoverable orders</p>
                <strong>{impact.recoverableOrders}</strong>
              </div>
              <div className="mini-stat">
                <p>Recoverable revenue</p>
                <strong>{formatCurrency(impact.recoverableRevenue)}</strong>
              </div>
            </div>
          </article>
        </section>
      </Reveal>

      <section className="card split-row">
        <div>
          <h2>Ready to go live?</h2>
          <p>Start with one agent, one webhook, and one product bundle.</p>
        </div>
        <div className="row gap-sm">
          <Link to="/signup">
            <Button>Get Started</Button>
          </Link>
          <Link to="/contact">
            <Button variant="secondary">Book Demo</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
