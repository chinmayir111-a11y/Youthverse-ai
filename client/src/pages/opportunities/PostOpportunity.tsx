import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea, fieldError } from '../../components/ui'
import { TYPE_ONE } from './shared'
import type { FieldError, OpportunityType } from '../../types'

const TYPES: OpportunityType[] = [
  'internship',
  'scholarship',
  'hackathon',
  'competition',
  'workshop',
  'webinar',
  'event',
]

const blank = {
  type: 'internship' as OpportunityType,
  title: '',
  organisation: '',
  description: '',
  location: '',
  isRemote: false,
  link: '',
  tags: '',
  eligibility: '',
  reward: '',
  deadline: '',
  startsAt: '',
}

/** `datetime-local` needs "YYYY-MM-DDTHH:mm" with no zone or seconds. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PostOpportunity() {
  const { opportunityId } = useParams()
  const isEdit = Boolean(opportunityId)
  const navigate = useNavigate()

  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<FieldError[]>([])

  useEffect(() => {
    if (!opportunityId) return
    api
      .get(`/opportunities/${opportunityId}`)
      .then(({ data }) => {
        const o = data.data.opportunity
        if (!o.canManage) {
          setError('You can only edit a posting you created.')
          return
        }
        setForm({
          type: o.type,
          title: o.title,
          organisation: o.organisation,
          description: o.description,
          location: o.location,
          isRemote: o.isRemote,
          link: o.link,
          tags: o.tags.join(', '),
          eligibility: o.eligibility,
          reward: o.reward,
          deadline: toLocalInput(o.deadline),
          startsAt: toLocalInput(o.startsAt),
        })
      })
      .catch((err) => setError(unwrapError(err).message))
  }, [opportunityId])

  const set = (updates: Partial<typeof blank>) => setForm((prev) => ({ ...prev, ...updates }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFields([])
    setSaving(true)

    const payload = {
      ...form,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    }

    try {
      const { data } = isEdit
        ? await api.patch(`/opportunities/${opportunityId}`, payload)
        : await api.post('/opportunities', payload)
      navigate(`/opportunities/${data.data.opportunity.id}`)
    } catch (err) {
      const unwrapped = unwrapError(err)
      setError(unwrapped.message)
      setFields(unwrapped.fields)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/opportunities" className="text-sm font-medium text-brand-600 hover:underline">
          ← All opportunities
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit posting' : 'Post an opportunity'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Anything a student here would want to know about. Be specific about eligibility — it is
          what people waste the most time on.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={form.type}
                onChange={(e) => set({ type: e.target.value as OpportunityType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_ONE[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Organisation" error={fieldError(fields, 'organisation')}>
              <Input
                value={form.organisation}
                onChange={(e) => set({ organisation: e.target.value })}
                placeholder="Fintech Co"
                required
              />
            </Field>
          </div>

          <Field label="Title" error={fieldError(fields, 'title')}>
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Backend Engineering Intern"
              required
            />
          </Field>

          <Field
            label="Description"
            hint="What it is, what you'd do, and why it's worth applying."
            error={fieldError(fields, 'description')}
          >
            <Textarea
              rows={5}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Pune"
                disabled={form.isRemote}
              />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isRemote}
                  onChange={(e) => set({ isRemote: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Fully remote
              </label>
            </div>
          </div>

          <Field label="Apply / register link">
            <Input
              value={form.link}
              onChange={(e) => set({ link: e.target.value })}
              placeholder="https://…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Applications close" hint="Leave blank if there's no cut-off.">
              <Input
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => set({ deadline: e.target.value })}
              />
            </Field>
            <Field label="Starts" hint="For events, webinars, and hackathons.">
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set({ startsAt: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={form.type === 'scholarship' ? 'Award' : 'Stipend / prize'}
              hint="Free text — say it the way the posting does."
            >
              <Input
                value={form.reward}
                onChange={(e) => set({ reward: e.target.value })}
                placeholder="₹25,000 / month"
              />
            </Field>
            <Field label="Tags" hint="Comma separated.">
              <Input
                value={form.tags}
                onChange={(e) => set({ tags: e.target.value })}
                placeholder="Node.js, Backend"
              />
            </Field>
          </div>

          <Field label="Eligibility" hint="Who can actually apply. Save people the disappointment.">
            <Textarea
              rows={2}
              value={form.eligibility}
              onChange={(e) => set({ eligibility: e.target.value })}
              placeholder="Final-year undergraduates only."
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Post opportunity'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/opportunities')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
