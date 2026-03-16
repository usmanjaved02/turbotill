import { CTASection } from '../../components/marketing/CTASection'
import { FeatureCard } from '../../components/marketing/FeatureCard'
import { Reveal } from '../../components/common/Reveal'
import { AgentCategoryVisual } from '../../components/marketing/AgentCategoryVisual'
import { AGENT_TYPE_OPTIONS } from '../../constants/agentTypes'
import { GEMINI_LIVE_LANGUAGE_OPTIONS, GEMINI_LIVE_VOICE_OPTIONS } from '../../constants/geminiLiveVoiceOptions'

export const FeaturesPage = () => {
  const voiceCount = GEMINI_LIVE_VOICE_OPTIONS.length
  const languageCount = GEMINI_LIVE_LANGUAGE_OPTIONS.length

  return (
    <div className="stack-xl">
      <section>
        <span className="eyebrow">Features</span>
        <h1>Everything needed to run reliable order-taking operations</h1>
        <p>
          Turbo Till combines category-based AI agents, voice ordering, product control, and webhook delivery in one
          clean workflow.
        </p>
      </section>

      <Reveal>
        <section>
          <div className="split-row wrap">
            <div className="stack-xs">
              <span className="eyebrow">Agent lineup</span>
              <h2>Built for multiple order entry points</h2>
            </div>
            <p className="muted">Pick the right category for how customers place orders.</p>
          </div>
          <div className="public-agent-type-grid top-gap">
            {AGENT_TYPE_OPTIONS.map((option) => (
              <article key={option.value} className={`card public-agent-type-card ${option.available ? 'is-live' : 'is-coming'}`}>
                <div className="public-agent-card-top">
                  <AgentCategoryVisual type={option.value} />
                  <div className="split-row">
                    <h3>{option.label}</h3>
                    <span className={`public-type-status ${option.available ? 'is-live' : 'is-coming'}`}>
                      {option.available ? 'Live' : 'Coming soon'}
                    </span>
                  </div>
                </div>
                <p>{option.shortDescription}</p>
                <p className="muted">{option.details}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="grid three-col">
          <FeatureCard title="Voice profile controls" description={`${voiceCount} presets across ${languageCount} language options.`} />
          <FeatureCard title="Live voice preview" description="Test how your agent sounds before activation." />
          <FeatureCard title="Roman Urdu transcript support" description="Supports spoken Urdu/Hindi workflows with Roman script transcript flow." />
          <FeatureCard title="No-response handling" description="Follow-up prompts and automatic session reset when customer is silent." />
          <FeatureCard title="Order repeat with totals" description="Agent repeats order summary with total before placement." />
          <FeatureCard title="Smart guidance absorb" description="System guidance avoids repeating the same question in multiple styles." />
        </section>
      </Reveal>

      <Reveal>
        <section className="grid three-col">
          <FeatureCard title="Product management" description="Manual creation, status controls, and clean catalog setup." />
          <FeatureCard title="Bulk CSV upload" description="Upload product lists quickly with a built-in import template flow." />
          <FeatureCard title="Product scope per agent" description="Allow all products or specific products by agent." />
          <FeatureCard title="Table QR flow" description="Generate table links and QR codes for mobile-first dine-in ordering." />
          <FeatureCard title="Webhook integrations" description="Send full order payloads with consistent structure to external systems." />
          <FeatureCard title="Order IDs per company" description="Unique order number format with company short key and daily counters." />
          <FeatureCard title="Professional order dashboard" description="Track source, status, agent owner, and complete line items at a glance." />
          <FeatureCard title="Team setup controls" description="Add organization users and assign workspace access quickly." />
          <FeatureCard title="Embeddable web mode" description="Run agent in embedded UI where website ordering is needed." />
        </section>
      </Reveal>

      <CTASection
        title="Move from missed orders to managed coverage"
        description="Launch category-based agents and keep order flow active throughout every shift."
      />
    </div>
  )
}
