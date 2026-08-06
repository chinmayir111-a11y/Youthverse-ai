import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea, fieldError } from '../../components/ui'
import { STATUS_ONE } from './shared'
import type { FieldError, ProjectIdea, ProjectStatus } from '../../types'

const STATUSES: ProjectStatus[] = ['idea', 'building', 'beta', 'shipped']

const blank = {
  title: '',
  tagline: '',
  description: '',
  status: 'building' as ProjectStatus,
  repoUrl: '',
  demoUrl: '',
  tech: '',
  tags: '',
  lookingForTeammates: false,
  rolesNeeded: '',
}

/** A generated idea, carried over from the Projects home page. */
const fromIdea = (idea: ProjectIdea) => ({
  ...blank,
  title: idea.title,
  tagline: idea.tagline,
  // The problem is the part a reader needs first; the build detail follows it.
  description: `${idea.problem}\n\n${idea.description}\n\nFirst milestone: ${idea.firstMilestone}`,
  status: 'idea' as ProjectStatus,
  tech: idea.tech.join(', '),
  lookingForTeammates: idea.rolesNeeded.length > 0,
  rolesNeeded: idea.rolesNeeded.join(', '),
})

export function PostProject() {
  const { projectId } = useParams()
  const isEdit = Boolean(projectId)
  const navigate = useNavigate()
  const location = useLocation()
  const idea = (location.state as { idea?: ProjectIdea } | null)?.idea

  const [form, setForm] = useState(() => (idea ? fromIdea(idea) : blank))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<FieldError[]>([])

  useEffect(() => {
    if (!projectId) return
    api
      .get(`/projects/${projectId}`)
      .then(({ data }) => {
        const p = data.data.project
        if (!p.canManage) {
          setError('You can only edit a project you created.')
          return
        }
        setForm({
          title: p.title,
          tagline: p.tagline,
          description: p.description,
          status: p.status,
          repoUrl: p.repoUrl,
          demoUrl: p.demoUrl,
          tech: p.tech.join(', '),
          tags: p.tags.join(', '),
          lookingForTeammates: p.lookingForTeammates,
          rolesNeeded: p.rolesNeeded.join(', '),
        })
      })
      .catch((err) => setError(unwrapError(err).message))
  }, [projectId])

  const set = (updates: Partial<typeof blank>) => setForm((prev) => ({ ...prev, ...updates }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFields([])
    setSaving(true)

    const list = (value: string) =>
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

    const payload = {
      ...form,
      tech: list(form.tech),
      tags: list(form.tags),
      rolesNeeded: list(form.rolesNeeded),
    }

    try {
      const { data } = isEdit
        ? await api.patch(`/projects/${projectId}`, payload)
        : await api.post('/projects', payload)
      navigate(`/projects/${data.data.project.id}`)
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
        <Link to="/projects" className="text-sm font-medium text-brand-600 hover:underline">
          ← All projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit project' : 'Post a project'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          An unfinished project is still worth posting — that is when teammates are most useful.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Title" error={fieldError(fields, 'title')}>
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Campus lost and found"
              required
            />
          </Field>

          <Field label="Tagline" hint="One line, the way it would read on a card.">
            <Input
              value={form.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="Post what you lost; get pinged when it turns up."
            />
          </Field>

          <Field
            label="Description"
            hint="What it does, who it's for, and where you've got to."
            error={fieldError(fields, 'description')}
          >
            <Textarea
              rows={6}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stage">
              <Select
                value={form.status}
                onChange={(e) => set({ status: e.target.value as ProjectStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_ONE[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tech" hint="Comma separated.">
              <Input
                value={form.tech}
                onChange={(e) => set({ tech: e.target.value })}
                placeholder="React, Node.js, MongoDB"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Repository" hint="GitHub, GitLab, anywhere the code lives.">
              <Input
                value={form.repoUrl}
                onChange={(e) => set({ repoUrl: e.target.value })}
                placeholder="https://github.com/…"
              />
            </Field>
            <Field label="Live demo" hint="Leave blank if there's nothing to show yet.">
              <Input
                value={form.demoUrl}
                onChange={(e) => set({ demoUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>

          <Field label="Topics" hint="What it's about, as opposed to what it's built with.">
            <Input
              value={form.tags}
              onChange={(e) => set({ tags: e.target.value })}
              placeholder="campus, accessibility"
            />
          </Field>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.lookingForTeammates}
                onChange={(e) => set({ lookingForTeammates: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Looking for teammates
            </label>
            <p className="mt-1 text-xs text-slate-500">
              People can only ask to join while this is on.
            </p>

            {form.lookingForTeammates && (
              <div className="mt-3">
                <Field label="Roles you need" hint="Comma separated. Be specific — vague roles get vague offers.">
                  <Input
                    value={form.rolesNeeded}
                    onChange={(e) => set({ rolesNeeded: e.target.value })}
                    placeholder="Frontend developer, Designer"
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Post project'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
