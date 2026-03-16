import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentForm } from '../../components/app/AgentForm'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { useApp } from '../../context/AppContext'
import { AGENT_TYPE_LABELS, AGENT_TYPE_OPTIONS } from '../../constants/agentTypes'
import type { AgentInput, AgentType } from '../../types'

export const AgentNewPage = () => {
  const navigate = useNavigate()
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType | null>(null)
  const {
    state: { products },
    createAgent,
    testAgentVoicePreview,
    testWebhook,
    appLoading,
  } = useApp()

  const save = async (payload: AgentInput) => {
    const agent = await createAgent(payload)
    navigate(`/app/agents/${agent.id}`)
  }

  const selectedTypeDetails = useMemo(
    () => AGENT_TYPE_OPTIONS.find((option) => option.value === selectedAgentType),
    [selectedAgentType]
  )

  return (
    <div className="stack-lg">
      <Modal
        open={!selectedAgentType}
        onClose={() => navigate('/app/agents')}
        title="Choose Agent Category"
      >
        <div className="agent-type-modal-grid">
          {AGENT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`mode-card agent-type-card ${!option.available ? 'disabled' : ''}`}
              disabled={!option.available}
              onClick={() => setSelectedAgentType(option.value)}
            >
              <div className="split-row">
                <strong>{option.label}</strong>
                {!option.available ? <span className="badge badge-warning">Coming soon</span> : null}
              </div>
              <p>{option.shortDescription}</p>
              <small className="muted">{option.details}</small>
            </button>
          ))}
        </div>
      </Modal>

      <section className="card agent-new-hero">
        <div className="split-row">
          <div className="stack-sm">
            <span className="section-kicker">Agent Builder</span>
            <h1>Create {selectedAgentType ? AGENT_TYPE_LABELS[selectedAgentType] : 'Turbo Till Agent'}</h1>
            <p className="muted agent-new-hero-copy">
              Build a production-ready AI agent with category-aware setup. Configure identity, voice, catalog access,
              webhook delivery, and channel behavior from one guided stepper flow.
            </p>
          </div>
          <div className="agent-new-hero-note">
            <strong>Best practice</strong>
            <p>
              {selectedTypeDetails?.details ??
                'Start with one focused agent, validate ordering flow and webhook delivery, then expand use cases.'}
            </p>
          </div>
        </div>
      </section>

      {products.length === 0 ? (
        <section className="card agent-prereq-banner">
          <div>
            <strong>Create products first before assigning catalog access.</strong>
            <p className="muted">Agents need product data so they can quote correct items, prices, and availability.</p>
          </div>
          <div className="row gap-sm wrap">
            <Button onClick={() => navigate('/app/products/new')}>Add Product</Button>
            <Button variant="secondary" onClick={() => navigate('/app/products')}>
              Review catalog
            </Button>
          </div>
        </section>
      ) : null}

      {selectedAgentType ? (
        <AgentForm
          products={products}
          initialAgentType={selectedAgentType}
          lockAgentType
          loading={appLoading}
          onSubmit={save}
          onSaveDraft={save}
          onCancel={() => navigate('/app/agents')}
          testVoicePreview={testAgentVoicePreview}
          testWebhook={testWebhook}
        />
      ) : null}
    </div>
  )
}
