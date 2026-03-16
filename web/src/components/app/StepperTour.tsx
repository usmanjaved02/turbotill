import { Button } from '../common/Button'

interface StepperTourProps {
  steps: { title: string; description: string }[]
  currentStep: number
  onStepChange: (nextStep: number) => void
  onFinish: () => void
  onSkip: () => void
}

export const StepperTour = ({ steps, currentStep, onStepChange, onFinish, onSkip }: StepperTourProps) => {
  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <section className="card stepper">
      <div className="split-row">
        <h2>{step.title}</h2>
        <button className="text-btn" onClick={onSkip}>
          Skip tour
        </button>
      </div>
      <p>{step.description}</p>
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="step-dot-row">
        {steps.map((item, index) => (
          <button
            key={item.title}
            onClick={() => onStepChange(index)}
            className={`step-dot ${index <= currentStep ? 'active' : ''}`}
          />
        ))}
      </div>
      <div className="row end gap-sm">
        <Button
          variant="secondary"
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          Back
        </Button>
        {currentStep === steps.length - 1 ? (
          <Button onClick={onFinish}>Create Your First Product</Button>
        ) : (
          <Button onClick={() => onStepChange(Math.min(steps.length - 1, currentStep + 1))}>Next</Button>
        )}
      </div>
    </section>
  )
}
