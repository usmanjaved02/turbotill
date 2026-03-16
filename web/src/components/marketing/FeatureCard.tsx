interface FeatureCardProps {
  title: string
  description: string
  eyebrow?: string
}

export const FeatureCard = ({ title, description, eyebrow }: FeatureCardProps) => (
  <article className="card feature-card">
    {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
    <h3>{title}</h3>
    <p>{description}</p>
  </article>
)
