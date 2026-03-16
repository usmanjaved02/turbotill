interface StatCardProps {
  label: string
  value: string | number
  trend?: string
}

export const StatCard = ({ label, value, trend }: StatCardProps) => (
  <article className="card stat-card">
    <p className="muted">{label}</p>
    <strong className="stat-value">{value}</strong>
    {trend ? <span className="stat-trend">{trend}</span> : null}
  </article>
)
