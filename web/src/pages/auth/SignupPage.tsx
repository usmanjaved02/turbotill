import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { useApp } from '../../context/AppContext'
import { evaluatePassword, getPasswordValidationMessage, isValidEmail } from '../../utils/authValidation'

interface SignupForm {
  fullName: string
  businessName: string
  email: string
  password: string
  confirmPassword: string
  terms: boolean
}

interface SignupErrors {
  fullName?: string
  businessName?: string
  email?: string
  password?: string
  confirmPassword?: string
  terms?: string
}

const initialForm: SignupForm = {
  fullName: '',
  businessName: '',
  email: '',
  password: '',
  confirmPassword: '',
  terms: false
}

export const SignupPage = () => {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({})
  const navigate = useNavigate()
  const { signup, appLoading } = useApp()

  const passwordRules = useMemo(() => evaluatePassword(form.password), [form.password])

  const validateForm = () => {
    const nextErrors: SignupErrors = {}

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.'
    }

    if (!form.businessName.trim()) {
      nextErrors.businessName = 'Business name is required.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!isValidEmail(form.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    const passwordMessage = getPasswordValidationMessage(form.password)
    if (!form.password) {
      nextErrors.password = 'Password is required.'
    } else if (passwordMessage) {
      nextErrors.password = passwordMessage
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.'
    } else if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    if (!form.terms) {
      nextErrors.terms = 'Please accept terms to continue.'
    }

    return nextErrors
  }

  return (
    <div className="auth-page">
      <form
        className="auth-card card stack-sm"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')

          const nextErrors = validateForm()
          setFieldErrors(nextErrors)
          if (Object.keys(nextErrors).length > 0) {
            return
          }

          try {
            await signup(
              {
                fullName: form.fullName.trim(),
                businessName: form.businessName.trim(),
                email: form.email.trim().toLowerCase()
              },
              form.password
            )
            navigate('/app/dashboard', { replace: true })
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Signup failed')
          }
        }}
      >
        <Link to="/" className="auth-brand" aria-label="TurboTill home">
          <img src="/turbotillicon.png" alt="TurboTill icon" className="auth-brand-icon" />
          <span className="auth-brand-logo-shell">
            <img src="/turbotillLogo.png" alt="TurboTill" className="auth-brand-logo" />
          </span>
        </Link>
        <h1>Sign up</h1>
        <p className="muted">Create your workspace and launch your first AI order agent.</p>

        <label>
          Full name
          <input
            className="input"
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            placeholder="Full name"
          />
          {fieldErrors.fullName ? <p className="error-text">{fieldErrors.fullName}</p> : null}
        </label>

        <label>
          Business name
          <input
            className="input"
            value={form.businessName}
            onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
            placeholder="Business name"
          />
          {fieldErrors.businessName ? <p className="error-text">{fieldErrors.businessName}</p> : null}
        </label>

        <label>
          Email
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="you@company.com"
          />
          {fieldErrors.email ? <p className="error-text">{fieldErrors.email}</p> : null}
        </label>

        <label>
          Password
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="12+ chars, mixed case, number, symbol"
          />
          {fieldErrors.password ? <p className="error-text">{fieldErrors.password}</p> : null}
        </label>

        <p className="muted">
          Password rules:
          <br />
          {passwordRules.minLength ? 'Yes' : 'No'} 12+ characters, {passwordRules.uppercase ? 'yes' : 'no'} uppercase,{' '}
          {passwordRules.lowercase ? 'yes' : 'no'} lowercase, {passwordRules.number ? 'yes' : 'no'} number,{' '}
          {passwordRules.symbol ? 'yes' : 'no'} symbol
        </p>

        <label>
          Confirm password
          <input
            type="password"
            className="input"
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            placeholder="Repeat password"
          />
          {fieldErrors.confirmPassword ? <p className="error-text">{fieldErrors.confirmPassword}</p> : null}
        </label>

        <label className="selector-item">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(event) => setForm((prev) => ({ ...prev, terms: event.target.checked }))}
          />
          <span>I agree to terms and privacy policy</span>
        </label>
        {fieldErrors.terms ? <p className="error-text">{fieldErrors.terms}</p> : null}

        <div className="grid two-col">
          <Button type="button" variant="secondary">
            Continue with Google
          </Button>
          <Button type="button" variant="secondary">
            Continue with Microsoft
          </Button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        <Button type="submit" disabled={appLoading}>
          {appLoading ? 'Creating account...' : 'Create account'}
        </Button>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  )
}
