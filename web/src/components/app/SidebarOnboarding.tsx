import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../common/Button'
import { useApp } from '../../context/AppContext'

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const steps = [
  {
    id: 'dashboard',
    eyebrow: 'Step 1',
    title: 'Start on the dashboard',
    description:
      'This is your control center. It gives you setup progress, recent activity, order visibility, and the next action to take.',
    why: 'Why this matters: your team can see setup status and live activity without opening multiple sections.',
    ctaLabel: 'Open dashboard',
    ctaTo: '/app/dashboard',
  },
  {
    id: 'products',
    eyebrow: 'Step 2',
    title: 'Add products before anything else',
    description:
      'Your catalog powers the rest of the platform. Agents, live order capture, and reporting all depend on the products you define here.',
    why: 'Why this matters: products become the single source of truth for pricing, availability, and order capture.',
    ctaLabel: 'Add first product',
    ctaTo: '/app/products/new',
  },
  {
    id: 'agents',
    eyebrow: 'Step 3',
    title: 'Create the agents that take fallback orders',
    description:
      'Set up agents for internal mic use or website embeds. Each one can have its own mode, webhook destination, and product access.',
    why: 'Why this matters: agents let you keep taking orders when human staff are unavailable or overloaded.',
    ctaLabel: 'Create agent',
    ctaTo: '/app/agents/new',
  },
  {
    id: 'orders',
    eyebrow: 'Step 4',
    title: 'Review every order in one queue',
    description:
      'Orders show the responsible agent, source, value, and status so your team can confirm and fulfill quickly.',
    why: 'Why this matters: a single order queue reduces missed follow-up and keeps fulfillment accountable.',
    ctaLabel: 'View orders',
    ctaTo: '/app/orders',
  },
  {
    id: 'integrations',
    eyebrow: 'Step 5',
    title: 'Connect the rest of your workflow',
    description:
      'Use integrations to send webhook notifications now and prepare for future catalog sync options when they ship.',
    why: 'Why this matters: integrations keep external systems in sync the moment an order is captured.',
    ctaLabel: 'Review integrations',
    ctaTo: '/app/integrations',
  },
  {
    id: 'settings-profile',
    eyebrow: 'Step 6',
    title: 'Finish profile and workspace setup',
    description:
      'Complete account details, workspace preferences, and agent defaults before switching an agent on for real order intake.',
    why: 'Why this matters: clean defaults reduce setup mistakes before you go live with customers.',
    ctaLabel: 'Open settings',
    ctaTo: '/app/settings/profile',
  },
]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const SidebarOnboarding = () => {
  const {
    signupOnboardingOpen,
    closeSignupOnboarding,
    state: { hasSeenSignupOnboarding },
  } = useApp()
  const open = signupOnboardingOpen && !hasSeenSignupOnboarding

  if (!open) return null

  return <SidebarOnboardingContent closeSignupOnboarding={closeSignupOnboarding} />
}

const SidebarOnboardingContent = ({ closeSignupOnboarding }: { closeSignupOnboarding: () => void }) => {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const step = steps[stepIndex]

  const updateRect = useCallback(() => {
    const target = document.querySelector<HTMLElement>(`[data-onboarding-id="${step.id}"]`)
    if (!target) {
      setRect(null)
      return
    }

    const bounds = target.getBoundingClientRect()
    setRect({
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height,
    })
  }, [step.id])

  useEffect(() => {
    if (showCompletion) return

    const frame = window.requestAnimationFrame(updateRect)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [showCompletion, updateRect])

  useEffect(() => {
    if (showCompletion) return

    const target = document.querySelector<HTMLElement>(`[data-onboarding-id="${step.id}"]`)
    if (!target) return

    target.classList.add('sidebar-link-onboarding-active')
    return () => {
      target.classList.remove('sidebar-link-onboarding-active')
    }
  }, [showCompletion, step.id])

  useEffect(() => {
    if (showCompletion) return

    const timeout = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const target = document.querySelector<HTMLElement>(`[data-onboarding-id="${step.id}"]`)
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      window.requestAnimationFrame(updateRect)
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [location.pathname, showCompletion, step.id, updateRect])

  const goToStep = (index: number) => {
    const boundedIndex = clamp(index, 0, steps.length - 1)
    setShowCompletion(false)
    setStepIndex(boundedIndex)
    navigate(steps[boundedIndex].ctaTo)
  }

  const openCompletion = () => {
    setShowCompletion(true)
  }

  const finishOnboarding = () => {
    closeSignupOnboarding()
    navigate('/app/products/new')
  }

  const panelTop = clamp(window.innerHeight * 0.18, 96, 132)
  const panelLeft = rect ? clamp(rect.left + rect.width + 26, 314, Math.max(314, window.innerWidth - 450)) : 330
  const pointerTop = rect ? clamp(rect.top + rect.height / 2 - panelTop - 14, 28, 260) : 44
  const isLastStep = stepIndex === steps.length - 1

  return (
    <div className="onboarding-layer" aria-live="polite">
      <div className="onboarding-backdrop" />
      {rect && !showCompletion ? (
        <div
          className="onboarding-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}
      <aside
        className={`onboarding-card ${showCompletion ? 'is-complete' : ''}`}
        style={{ top: `${panelTop}px`, left: `${panelLeft}px`, maxHeight: 'calc(100vh - 2rem)' }}
      >
        {!showCompletion ? <span className="onboarding-pointer" style={{ top: `${pointerTop}px` }} aria-hidden="true" /> : null}
        <div className="onboarding-card-header">
          <span className="onboarding-step-pill">{showCompletion ? 'Complete' : step.eyebrow}</span>
          <strong>{showCompletion ? 'Ready to start' : `${stepIndex + 1} / ${steps.length}`}</strong>
        </div>
        <div className="stack-sm">
          <h3>{showCompletion ? 'Your workspace walkthrough is complete' : step.title}</h3>
          <p className="muted">
            {showCompletion
              ? 'You now know where products, agents, orders, integrations, and settings live. The best next move is to create your first catalog item.'
              : step.description}
          </p>
          <p className="onboarding-why">
            {showCompletion
              ? 'Why this matters: once your first product is in place, the rest of the setup becomes much easier to validate.'
              : step.why}
          </p>
        </div>
        <div className="onboarding-progress">
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`onboarding-progress-dot ${!showCompletion && index === stepIndex ? 'active' : ''}`}
              onClick={() => goToStep(index)}
              aria-label={`Go to onboarding step ${index + 1}`}
            />
          ))}
          <span className={`onboarding-progress-dot onboarding-progress-dot-summary ${showCompletion ? 'active' : ''}`} />
        </div>
        <div className="onboarding-actions">
          <div className="onboarding-action-row onboarding-action-row-primary">
            {showCompletion ? (
              <Button type="button" variant="secondary" onClick={() => goToStep(steps.length - 1)}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0}>
                Back
              </Button>
            )}
            {showCompletion ? (
              <Button type="button" onClick={finishOnboarding}>Create first product</Button>
            ) : isLastStep ? (
              <Button type="button" onClick={openCompletion}>Finish</Button>
            ) : (
              <Button type="button" onClick={() => goToStep(stepIndex + 1)}>Next</Button>
            )}
          </div>
          <div className="onboarding-action-row onboarding-action-row-secondary">
            {!showCompletion ? (
              <button type="button" className="btn btn-ghost btn-md" onClick={() => navigate(step.ctaTo)}>
                <span>{step.ctaLabel}</span>
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-md" onClick={() => navigate('/app/dashboard')}>
                <span>Return to dashboard</span>
              </button>
            )}
            <button type="button" className="text-btn onboarding-skip-btn" onClick={closeSignupOnboarding}>
              Skip onboarding
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
