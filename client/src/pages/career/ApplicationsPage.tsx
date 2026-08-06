import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import type { Application, ApplicationStage } from '../../types'

const STAGE_LABEL: Record<ApplicationStage, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

const STAGE_TONE: Record<ApplicationStage, string> = {
  wishlist: 'bg-slate-100 text-slate-700',
  applied: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
  assessment: 'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
  interview: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
  offer: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  rejected: 'bg-slate-100 text-slate-500',
}

const dateInput = (value: string | null) => (value ? value.slice(0, 10) : '')

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [form, setForm] = useState({
    company: '',
    role: '',
    location: '',
    link: '',
    stage: 'applied' as ApplicationStage,
    appliedOn: '',
    nextStepOn: '',
    notes: '',
  })

  useEffect(() => {
    api
      .get('/career/applications')
      .then(({ data }) => {
        setApplications(data.data.applications)
        setStages(data.data.stages)
      })
      .catch((err) => setError(unwrapError(err).message))
      .finally(() => setLoading(false))
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    setError('')
    setCreating(true)
    try {
      const { data } = await api.post('/career/applications', form)
      setApplications((prev) => [data.data.application, ...prev])
      setForm({
        company: '',
        role: '',
        location: '',
        link: '',
        stage: 'applied',
        appliedOn: '',
        nextStepOn: '',
        notes: '',
      })
      setShowForm(false)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setCreating(false)
    }
  }

  const patch = async (id: string, updates: Partial<Application>) => {
    setError('')
    try {
      const { data } = await api.patch(`/career/applications/${id}`, updates)
      setApplications((prev) => prev.map((a) => (a.id === id ? data.data.application : a)))
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const remove = async (app: Application) => {
    if (!window.confirm(`Remove ${app.role} at ${app.company}?`)) return
    setError('')
    try {
      await api.delete(`/career/applications/${app.id}`)
      setApplications((prev) => prev.filter((a) => a.id !== app.id))
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const counts = useMemo(() => {
    const out: Partial<Record<ApplicationStage, number>> = {}
    for (const a of applications) out[a.stage] = (out[a.stage] ?? 0) + 1
    return out
  }, [applications])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placement Tracker</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every application and what happens next, so nothing goes quiet unnoticed.
          </p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          variant={showForm ? 'secondary' : 'primary'}
        >
          {showForm ? 'Cancel' : 'Add application'}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {stages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stages.map((stage) => (
            <span
              key={stage}
              className={`rounded-full px-3 py-1 text-xs font-medium ${STAGE_TONE[stage]}`}
            >
              {STAGE_LABEL[stage]} · {counts[stage] ?? 0}
            </span>
          ))}
        </div>
      )}

      {showForm && (
        <Card title="New application">
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company">
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                />
              </Field>
              <Field label="Role">
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  required
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
              <Field label="Link">
                <Input
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Stage">
                <Select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as ApplicationStage })}
                >
                  {(stages.length ? stages : (Object.keys(STAGE_LABEL) as ApplicationStage[])).map(
                    (s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field label="Applied on">
                <Input
                  type="date"
                  value={form.appliedOn}
                  onChange={(e) => setForm({ ...form, appliedOn: e.target.value })}
                />
              </Field>
              <Field label="Next step on">
                <Input
                  type="date"
                  value={form.nextStepOn}
                  onChange={(e) => setForm({ ...form, nextStepOn: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Referral, recruiter name, what to follow up on…"
              />
            </Field>
            <Button type="submit" loading={creating}>
              Add application
            </Button>
          </form>
        </Card>
      )}

      <Card title="Applications">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing tracked yet. Add the first one — including the ones you have only bookmarked.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {applications.map((app) => (
              <li key={app.id} className="space-y-2 py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {app.role}
                      <span className="font-normal text-slate-500"> · {app.company}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {[
                        app.location,
                        app.appliedOn && `applied ${new Date(app.appliedOn).toLocaleDateString()}`,
                        app.nextStepOn &&
                          `next step ${new Date(app.nextStepOn).toLocaleDateString()}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <Select
                    className="w-auto"
                    value={app.stage}
                    aria-label={`Stage for ${app.role} at ${app.company}`}
                    onChange={(e) =>
                      void patch(app.id, { stage: e.target.value as ApplicationStage })
                    }
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </Select>

                  <Input
                    type="date"
                    className="w-auto"
                    aria-label={`Next step date for ${app.role} at ${app.company}`}
                    defaultValue={dateInput(app.nextStepOn)}
                    onChange={(e) => void patch(app.id, { nextStepOn: e.target.value || null })}
                  />

                  <button
                    onClick={() => void remove(app)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>

                {app.notes && <p className="text-sm text-slate-600">{app.notes}</p>}
                {app.link && (
                  <a
                    href={app.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs break-all text-brand-600 hover:underline"
                  >
                    {app.link}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
