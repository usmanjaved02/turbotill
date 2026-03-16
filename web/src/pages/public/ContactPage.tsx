import { useState } from 'react'
import { Button } from '../../components/common/Button'

interface ContactForm {
  name: string
  businessName: string
  email: string
  phone: string
  agentCategory: string
  monthlyOrderVolume: string
  message: string
}

const initialForm: ContactForm = {
  name: '',
  businessName: '',
  email: '',
  phone: '',
  agentCategory: '',
  monthlyOrderVolume: '',
  message: '',
}

export const ContactPage = () => {
  const [form, setForm] = useState(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="stack-xl">
      <section>
        <span className="eyebrow">Contact</span>
        <h1>Request a tailored demo</h1>
        <p>Share your order flow and we will suggest the right Turbo Till setup for your team.</p>
      </section>

      <form
        className="card stack-sm"
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(false)
          setError('')
          if (!form.name || !form.email || !form.businessName) {
            setError('Please fill in name, business name, and email.')
            return
          }
          setSubmitted(true)
          setForm(initialForm)
        }}
      >
        <div className="grid two-col">
          <label>
            Name
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Full name"
            />
          </label>
          <label>
            Business name
            <input
              className="input"
              value={form.businessName}
              onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
              placeholder="Business"
            />
          </label>
          <label>
            Email
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@company.com"
            />
          </label>
          <label>
            Phone
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+1 (555) 123-4567"
            />
          </label>
          <label>
            Main agent category
            <select
              className="input"
              value={form.agentCategory}
              onChange={(event) => setForm((prev) => ({ ...prev, agentCategory: event.target.value }))}
            >
              <option value="">Select category</option>
              <option value="terminal">Terminal Agent</option>
              <option value="table_order_taker">Table Order Taker</option>
              <option value="whatsapp_call_attendant">WhatsApp Call Attendant (Coming Soon)</option>
            </select>
          </label>
          <label>
            Monthly order volume
            <input
              className="input"
              value={form.monthlyOrderVolume}
              onChange={(event) => setForm((prev) => ({ ...prev, monthlyOrderVolume: event.target.value }))}
              placeholder="e.g. 4,000"
            />
          </label>
        </div>

        <label>
          Message
          <textarea
            className="input"
            value={form.message}
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
            placeholder="Share your current workflow and requirements"
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}
        {submitted ? <p className="success-text">Thanks. Our team will contact you shortly.</p> : null}

        <div className="row end">
          <Button type="submit">Submit Request</Button>
        </div>
      </form>
    </div>
  )
}
