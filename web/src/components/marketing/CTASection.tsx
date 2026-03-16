import { Link } from 'react-router-dom'
import { Button } from '../common/Button'

interface CTASectionProps {
  title: string
  description: string
}

export const CTASection = ({ title, description }: CTASectionProps) => (
  <section className="cta-banner card">
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
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
)
