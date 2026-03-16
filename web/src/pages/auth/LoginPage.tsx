import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { useApp } from '../../context/AppContext'

export const LoginPage = () => {
  const navigate = useNavigate()
  const {
    login,
    appLoading,
    state: { isAuthenticated },
  } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="auth-page">
      <form
        className="auth-card card stack-sm"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          if (!email || !password) {
            setError('Please enter email and password.')
            return
          }
          try {
            await login(email, password)
            navigate('/app/dashboard', { replace: true })
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Login failed')
          }
        }}
      >
        <Link to="/" className="auth-brand" aria-label="TurboTill home">
          <img src="/turbotillicon.png" alt="TurboTill icon" className="auth-brand-icon" />
          <span className="auth-brand-logo-shell">
            <img src="/turbotillLogo.png" alt="TurboTill" className="auth-brand-logo" />
          </span>
        </Link>
        <h1>Login</h1>
        <p className="muted">Continue managing your order workflows.</p>
        <label>
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@business.com"
          />
        </label>
        <label>
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>
        <Link to="/contact" className="text-link">
          Forgot password?
        </Link>
        {error ? <p className="error-text">{error}</p> : null}
        <Button type="submit" disabled={appLoading}>
          {appLoading ? 'Logging in...' : 'Login'}
        </Button>
        <p>
          New to Turbo Till? <Link to="/signup">Create account</Link>
        </p>
      </form>
    </div>
  )
}
