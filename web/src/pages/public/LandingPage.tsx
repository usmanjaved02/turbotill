import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CTASection } from '../../components/marketing/CTASection'
import { FeatureCard } from '../../components/marketing/FeatureCard'
import { FAQAccordion } from '../../components/marketing/FAQAccordion'
import { TestimonialsSection } from '../../components/marketing/TestimonialsSection'
import { AgentCategoryVisual } from '../../components/marketing/AgentCategoryVisual'
import { Button } from '../../components/common/Button'
import { Reveal } from '../../components/common/Reveal'
import { Tabs, type TabItem } from '../../components/common/Tabs'
import { useApp } from '../../context/AppContext'
import { AGENT_TYPE_OPTIONS } from '../../constants/agentTypes'
import type { AgentType } from '../../types'
import { GEMINI_LIVE_LANGUAGE_OPTIONS, GEMINI_LIVE_VOICE_OPTIONS } from '../../constants/geminiLiveVoiceOptions'

export const LandingPage = () => {
  const [activeTab, setActiveTab] = useState('products')
  const { openShopifyModal } = useApp()
  const voiceCount = GEMINI_LIVE_VOICE_OPTIONS.length
  const languageCount = GEMINI_LIVE_LANGUAGE_OPTIONS.length

  const agentTypeHighlights: Record<AgentType, string[]> = {
    terminal: ['Best for desk/operator calls', 'Switch on/off anytime', 'Supports full or selected products'],
    table_order_taker: ['Customer scans QR at table', 'Mobile-first voice ordering', 'Table occupancy controls included'],
    whatsapp_call_attendant: ['Inbound call assistant', 'Built on same order engine', 'Planned for upcoming release'],
  }

  const featureTabs: TabItem[] = [
    {
      key: 'products',
      label: 'Product Management',
      content: (
        <p>
          Add products manually today, upload in bulk with CSV, control scope per agent, and keep workflows ready for
          Shopify sync.
        </p>
      ),
    },
    {
      key: 'agents',
      label: 'AI Agents',
      content: (
        <p>
          Run Terminal and Table Order Taker agents now, with WhatsApp Call Attendant coming soon. Pick from {voiceCount}{' '}
          voice presets in {languageCount} supported languages.
        </p>
      ),
    },
    {
      key: 'webhooks',
      label: 'Webhook Routing',
      content: (
        <p>
          Send complete order payloads to ERP, CRM, fulfillment, or custom apps with consistent structure and delivery
          visibility.
        </p>
      ),
    },
  ]

  const faqs = [
    {
      question: 'Can I keep human order taking active?',
      answer: 'Yes. This product is built for hybrid operations where humans and AI agents alternate by schedule.',
    },
    {
      question: 'Do agents support product restrictions?',
      answer: 'Yes. You can grant all products or selected products only per agent.',
    },
    {
      question: 'Can I use table QR ordering for dine-in?',
      answer: 'Yes. Table Order Taker agents generate table links/QR flow and can enforce one active order per table.',
    },
    {
      question: 'How fast can we launch?',
      answer: 'Most teams can launch product catalog + first agent + webhook in under one hour.',
    },
  ]

  return (
    <div className="stack-xl">
      <section className="hero-grid">
        <div>
          <span className="eyebrow">Turbo Till Platform</span>
          <h1>Run voice-powered order operations across desk, table, and web.</h1>
          <p>
            Create category-based AI agents, test voice profiles, capture live orders, and route complete payloads to
            your business systems.
          </p>
          <div className="row gap-sm">
            <Link to="/signup">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="secondary">
                Book Demo
              </Button>
            </Link>
          </div>
          <div className="chip-wrap top-gap">
            <span className="chip">Terminal + Table Agents</span>
            <span className="chip">Live Voice + QR Flow</span>
            <span className="chip">Webhook Ready</span>
          </div>
        </div>

        <div className="dashboard-preview card">
          <div className="preview-header">
            <strong>Live Operations Snapshot</strong>
            <span className="pulse-dot" />
          </div>
          <div className="preview-cards">
            <article className="mini-card">
              <p>Orders today</p>
              <strong>42</strong>
            </article>
            <article className="mini-card">
              <p>Active agents</p>
              <strong>3</strong>
            </article>
            <article className="mini-card">
              <p>Webhook uptime</p>
              <strong>99.9%</strong>
            </article>
          </div>
          <div className="preview-table">
            <p>Recent order feed</p>
            <ul className="line-list">
              <li>XS-26-03-15-0011 captured by Terminal Agent</li>
              <li>XS-26-03-15-0010 from Table T-04 QR voice flow</li>
              <li>XS-26-03-15-0009 delivered to webhook successfully</li>
            </ul>
          </div>
        </div>
      </section>

      <Reveal>
        <section>
          <div className="split-row wrap">
            <div className="stack-xs">
              <span className="eyebrow">Agent categories</span>
              <h2>Choose the right agent for each order channel</h2>
            </div>
            <Link to="/how-it-works">
              <Button variant="secondary" size="sm">
                View full workflow
              </Button>
            </Link>
          </div>
          <div className="public-agent-type-grid top-gap">
            {AGENT_TYPE_OPTIONS.map((option) => (
              <article
                key={option.value}
                className={`card public-agent-type-card ${option.available ? 'is-live' : 'is-coming'}`}
              >
                <div className="public-agent-card-top">
                  <AgentCategoryVisual type={option.value} />
                  <div className="split-row">
                    <h3>{option.label}</h3>
                    <span className={`public-type-status ${option.available ? 'is-live' : 'is-coming'}`}>
                      {option.available ? 'Available now' : 'Coming soon'}
                    </span>
                  </div>
                </div>
                <p>{option.shortDescription}</p>
                <ul className="line-list">
                  {agentTypeHighlights[option.value].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2>How it works</h2>
          <div className="grid four-col top-gap">
            <FeatureCard title="Choose category" description="Pick Terminal, Table Order Taker, or WhatsApp (soon)." />
            <FeatureCard title="Set profile + voice" description="Add clear instructions and test exactly how it sounds." />
            <FeatureCard title="Connect products + webhook" description="Control product scope and event delivery path." />
            <FeatureCard title="Go live safely" description="Activate when needed and track each order instantly." />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2>Feature highlights</h2>
          <Tabs tabs={featureTabs} activeKey={activeTab} onChange={setActiveTab} />
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2>Built for real operations teams</h2>
          <div className="grid two-col top-gap">
            <FeatureCard title="Small shops" description="Keep sales active during short staff gaps." />
            <FeatureCard title="Restaurants and cafes" description="Use table QR voice ordering for dine-in customers." />
            <FeatureCard title="Human-assisted order desks" description="Use Terminal Agent as backup during peak periods." />
            <FeatureCard
              title="Multi-location brands"
              description="Standardize order flow, webhook payloads, and tracking across teams."
            />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="grid two-col">
          <FeatureCard
            eyebrow="Why switch"
            title="AI order support that feels operationally safe"
            description="Keep control with manual fallback, explicit activation toggle, and clear order ownership by agent."
          />
          <FeatureCard
            eyebrow="Hybrid workflow"
            title="Manual + AI continuity"
            description="Humans lead during normal operations, and agents handle temporary coverage with zero confusion."
          />
        </section>
      </Reveal>

      <Reveal>
        <section className="card split-row">
          <div>
            <h2>Coming soon: Shopify integration</h2>
            <p>Sync catalog and inventory automatically while keeping your existing agent workflows.</p>
          </div>
          <Button variant="secondary" onClick={openShopifyModal}>
            Join waitlist
          </Button>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2>Trusted by forward-moving operations teams</h2>
          <TestimonialsSection />
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2>Frequently asked questions</h2>
          <FAQAccordion items={faqs} />
        </section>
      </Reveal>

      <CTASection
        title="Start capturing every order with confidence"
        description="Set up your first agent and workflow in one guided onboarding flow."
      />

      <footer className="footer">
        <p>Turbo Till © 2026. Built for hybrid human + AI order operations.</p>
      </footer>
    </div>
  )
}
