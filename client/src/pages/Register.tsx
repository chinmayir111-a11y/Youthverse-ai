import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { unwrapError } from '../lib/api'
import { Alert, Button, Field, Input, Select, fieldError } from '../components/ui'
import { AuthLayout } from './AuthLayout'
import type { FieldError } from '../types'

export function Register() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'mentor',
  })
  const [error, setError] = useState('')
  const [fields, setFields] = useState<FieldError[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFields([])
    setSubmitting(true)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (err) {
      const { message, fields: f } = unwrapError(err)
      setError(message)
      setFields(f)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Free for students. No credit card.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <Field label="Full name" error={fieldError(fields, 'name')}>
          <Input
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="Aisha Khan"
          />
        </Field>

        <Field label="Email" error={fieldError(fields, 'email')}>
          <Input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            placeholder="you@university.edu"
          />
        </Field>

        <Field
          label="Password"
          hint="At least 8 characters."
          error={fieldError(fields, 'password')}
        >
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="I am a" error={fieldError(fields, 'role')}>
          <Select value={form.role} onChange={(e) => set('role')(e.target.value)}>
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
          </Select>
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
