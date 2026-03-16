import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AgentForm } from '../../components/app/AgentForm'
import { useApp } from '../../context/AppContext'
import { AGENT_TYPE_LABELS } from '../../constants/agentTypes'
import type { AgentInput } from '../../types'

export const AgentEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    state: { agents, products },
    updateAgent,
    testAgentVoicePreview,
    testWebhook,
    appLoading,
  } = useApp()

  const agent = agents.find((item) => item.id === id)
  if (!agent) return <Navigate to="/app/agents" replace />

  const save = async (payload: AgentInput) => {
    await updateAgent(agent.id, payload)
    navigate(`/app/agents/${agent.id}`)
  }

  return (
    <div className="stack-lg">
      <section className="card agent-new-hero">
        <div className="split-row">
          <div className="stack-sm">
            <span className="section-kicker">Agent Builder</span>
            <h1>Edit {agent.name}</h1>
            <p className="muted agent-new-hero-copy">
              Update category settings, voice profile, product access, webhook integration, and delivery mode.
            </p>
          </div>
          <div className="agent-new-hero-note">
            <strong>Current category</strong>
            <p>{AGENT_TYPE_LABELS[agent.agentType]}</p>
          </div>
        </div>
      </section>
      <AgentForm
        products={products}
        initialValue={agent}
        initialAgentType={agent.agentType}
        loading={appLoading}
        onSubmit={save}
        onSaveDraft={save}
        onCancel={() => navigate(`/app/agents/${agent.id}`)}
        submitLabel="Save changes"
        testVoicePreview={testAgentVoicePreview}
        testWebhook={testWebhook}
      />
    </div>
  )
}
