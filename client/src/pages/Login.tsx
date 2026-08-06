import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { unwrapError } from '../lib/api'
import { Alert, Button, Field, Input } from '../components/ui'
import { AuthLayout } from './AuthLayout'

export function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue your journey.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>

        <p className="text-center text-sm text-slate-600">
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
