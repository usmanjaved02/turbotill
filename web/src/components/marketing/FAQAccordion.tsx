import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQAccordionProps {
  items: FAQItem[]
}

export const FAQAccordion = ({ items }: FAQAccordionProps) => {
  const [open, setOpen] = useState<string>(items[0]?.question ?? '')

  return (
    <section className="faq-list">
      {items.map((item) => (
        <article className="card faq-item" key={item.question}>
          <button className="faq-question" onClick={() => setOpen((prev) => (prev === item.question ? '' : item.question))}>
            <strong>{item.question}</strong>
            <span>{open === item.question ? '-' : '+'}</span>
          </button>
          {open === item.question ? <p>{item.answer}</p> : null}
        </article>
      ))}
    </section>
  )
}
