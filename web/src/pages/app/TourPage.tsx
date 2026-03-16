import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StepperTour } from '../../components/app/StepperTour'
import { useApp } from '../../context/AppContext'

const steps = [
  {
    title: 'What the platform does',
    description:
      'Turbo Till helps businesses capture orders with AI when human order takers are temporarily unavailable.',
  },
  {
    title: 'How products work',
    description: 'Add products manually, set price and status, and control what each agent can sell.',
  },
  {
    title: 'How agents work',
    description: 'Create multiple agents for shifts, channels, and special product groups.',
  },
  {
    title: 'Mic UI vs script embed',
    description: 'Use built-in mic UI for internal ops or script mode for websites and landing pages.',
  },
  {
    title: 'Webhook notifications',
    description: 'Send order events to external systems for fulfillment, CRM, and analytics.',
  },
  {
    title: 'Operational toggle',
    description: 'Turn agent mode on or off whenever the human order taker steps away.',
  },
]

export const TourPage = () => {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const { signupOnboardingOpen, closeSignupOnboarding } = useApp()

  useEffect(() => {
    if (signupOnboardingOpen) closeSignupOnboarding()
  }, [signupOnboardingOpen, closeSignupOnboarding])

  return (
    <div className="stack-lg">
      <h1>Product Tour</h1>
      <p>Use this page as a self-serve walkthrough. New accounts now get guided onboarding directly inside the app shell.</p>

      <StepperTour
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        onSkip={() => navigate('/app/dashboard')}
        onFinish={() => navigate('/app/products/new')}
      />
    </div>
  )
}
