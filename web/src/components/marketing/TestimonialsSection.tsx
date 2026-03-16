const testimonials = [
  {
    quote: 'We now keep capturing orders even during shift gaps. Revenue leakage dropped immediately.',
    name: 'Jordan Lee',
    role: 'Operations Manager, Daily Bean',
  },
  {
    quote: 'The webhook flow plugged into our order stack in one afternoon.',
    name: 'Monica Hill',
    role: 'Tech Lead, MenuFlow Kitchens',
  },
  {
    quote: 'The hybrid human + AI mode gives us control without missing customers.',
    name: 'Chris Powell',
    role: 'Owner, Northline Deli Supply',
  },
]

export const TestimonialsSection = () => (
  <section className="grid three-col">
    {testimonials.map((item) => (
      <article key={item.name} className="card testimonial-card">
        <p>"{item.quote}"</p>
        <strong>{item.name}</strong>
        <span className="muted">{item.role}</span>
      </article>
    ))}
  </section>
)
