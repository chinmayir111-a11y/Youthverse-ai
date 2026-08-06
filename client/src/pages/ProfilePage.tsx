import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { api, unwrapError } from '../lib/api'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  TagInput,
  Textarea,
  fieldError,
} from '../components/ui'
import type { FieldError, Profile } from '../types'

interface FormState {
  name: string
  bio: string
  location: string
  educationLevel: Profile['educationLevel']
  institution: string
  fieldOfStudy: string
  graduationYear: string
  skills: string[]
  interests: string[]
  goals: string[]
  githubUrl: string
  linkedinUrl: string
  portfolioUrl: string
}

export function ProfilePage() {
  const { user, profile, setProfile, setUser } = useAuth()
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<FieldError[]>([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Seed the form once the profile has loaded.
  useEffect(() => {
    if (!user || !profile) return
    setForm({
      name: user.name,
      bio: profile.bio,
      location: profile.location,
      educationLevel: profile.educationLevel,
      institution: profile.institution,
      fieldOfStudy: profile.fieldOfStudy,
      graduationYear: profile.graduationYear ? String(profile.graduationYear) : '',
      skills: profile.skills,
      interests: profile.interests,
      goals: profile.goals,
      githubUrl: profile.githubUrl,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
    })
  }, [user, profile])

  if (!form) return <p className="text-sm text-slate-500">Loading your profile…</p>

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFields([])
    setSaved(false)
    setSaving(true)
    try {
      const { data } = await api.put('/users/me/profile', {
        ...form,
        // Send null rather than "" so the server's optional-int check passes.
        graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
      })
      setProfile(data.data.profile)
      setUser(data.data.user)
      setSaved(true)
    } catch (err) {
      const { message, fields: f } = unwrapError(err)
      setError(message)
      setFields(f)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          This is what powers personalised recommendations across the platform.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {saved && <Alert kind="success">Profile saved.</Alert>}

      <Card title="Personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={fieldError(fields, 'name')}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Location" error={fieldError(fields, 'location')}>
            <Input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Pune, India"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Bio"
              hint={`${form.bio.length}/500 characters`}
              error={fieldError(fields, 'bio')}
            >
              <Textarea
                rows={3}
                maxLength={500}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="A sentence or two about who you are and what you're working towards."
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Academic">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Education level" error={fieldError(fields, 'educationLevel')}>
            <Select
              value={form.educationLevel}
              onChange={(e) => set('educationLevel', e.target.value as Profile['educationLevel'])}
            >
              <option value="">Select…</option>
              <option value="school">School</option>
              <option value="diploma">Diploma</option>
              <option value="undergraduate">Undergraduate</option>
              <option value="postgraduate">Postgraduate</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Institution" error={fieldError(fields, 'institution')}>
            <Input
              value={form.institution}
              onChange={(e) => set('institution', e.target.value)}
              placeholder="Pune University"
            />
          </Field>
          <Field label="Field of study" error={fieldError(fields, 'fieldOfStudy')}>
            <Input
              value={form.fieldOfStudy}
              onChange={(e) => set('fieldOfStudy', e.target.value)}
              placeholder="Computer Science"
            />
          </Field>
          <Field label="Graduation year" error={fieldError(fields, 'graduationYear')}>
            <Input
              type="number"
              min={1950}
              max={2100}
              value={form.graduationYear}
              onChange={(e) => set('graduationYear', e.target.value)}
              placeholder="2027"
            />
          </Field>
        </div>
      </Card>

      <Card title="Skills, interests & goals" description="Comma-separated. Click away to save.">
        <div className="space-y-4">
          <Field label="Skills">
            <TagInput
              value={form.skills}
              onChange={(v) => set('skills', v)}
              placeholder="Python, React, Data Analysis"
            />
          </Field>
          <Field label="Interests">
            <TagInput
              value={form.interests}
              onChange={(v) => set('interests', v)}
              placeholder="Machine Learning, Startups"
            />
          </Field>
          <Field label="Goals">
            <TagInput
              value={form.goals}
              onChange={(v) => set('goals', v)}
              placeholder="Land an ML internship"
            />
          </Field>
        </div>
      </Card>

      <Card title="Links" description="Full URLs, including https://">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub" error={fieldError(fields, 'githubUrl')}>
            <Input
              value={form.githubUrl}
              onChange={(e) => set('githubUrl', e.target.value)}
              placeholder="https://github.com/username"
            />
          </Field>
          <Field label="LinkedIn" error={fieldError(fields, 'linkedinUrl')}>
            <Input
              value={form.linkedinUrl}
              onChange={(e) => set('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Portfolio" error={fieldError(fields, 'portfolioUrl')}>
              <Input
                value={form.portfolioUrl}
                onChange={(e) => set('portfolioUrl', e.target.value)}
                placeholder="https://yoursite.com"
              />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
