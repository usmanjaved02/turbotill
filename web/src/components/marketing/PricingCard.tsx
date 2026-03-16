import { Button } from '../common/Button'

interface PricingCardProps {
  plan: string
  price: string
  summary: string
  features: string[]
  highlighted?: boolean
}

export const PricingCard = ({ plan, price, summary, features, highlighted }: PricingCardProps) => (
  <article className={`card pricing-card ${highlighted ? 'highlight' : ''}`}>
    <h3>{plan}</h3>
    <p className="price">{price}</p>
    <p>{summary}</p>
    <ul className="line-list">
      {features.map((feature) => (
        <li key={feature}>{feature}</li>
      ))}
    </ul>
    <Button variant={highlighted ? 'primary' : 'secondary'}>Choose {plan}</Button>
  </article>
)
