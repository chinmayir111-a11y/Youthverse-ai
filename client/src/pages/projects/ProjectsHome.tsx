import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Input, Textarea } from '../../components/ui'
import { ProjectCard, STATUS_LABEL } from './shared'
import type { Project, ProjectIdeasPayload, ProjectMeta } from '../../types'

type View = 'all' | 'mine'

const DIFFICULTY_TONE: Record<string, string> = {
  beginner: 'text-emerald-700',
  intermediate: 'text-amber-700',
  advanced: 'text-rose-700',
}

export function ProjectsHome() {
  const [projects, setProjects] = useState<Project[]>([])
  const [meta, setMeta] = useState<ProjectMeta | null>(null)
  const [view, setView] = useState<View>('all')
  const [status, setStatus] = useState('')
  const [tech, setTech] = useState('')
  const [openTeams, setOpenTeams] = useState(false)
  const [sort, setSort] = useState<'recent' | 'rated'>('recent')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [brief, setBrief] = useState('')
  const [ideas, setIdeas] = useState<ProjectIdeasPayload | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      if (view === 'mine') {
        const { data } = await api.get('/projects/me')
        setProjects(data.data.projects)
      } else {
        const params: Record<string, string> = {}
        if (status) params.status = status
        if (tech) params.tech = tech
        if (openTeams) params.lookingForTeammates = 'true'
        if (sort === 'rated') params.sort = 'rated'
        if (query.trim()) params.q = query.trim()

        const { data } = await api.get('/projects', { params })
        setProjects(data.data.projects)
      }
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [view, status, tech, openTeams, sort, query])

  // `query` is deliberately not a dependency of the auto-load: search runs on
  // submit, while the chips and toggles apply immediately.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, status, tech, openTeams, sort])

  useEffect(() => {
    api
      .get('/projects/meta')
      .then(({ data }) => setMeta(data.data))
      .catch(() => {
        /* the list still works without the filter counts */
      })
  }, [])

  const generate = async () => {
    setError('')
    setGenerating(true)
    try {
      const { data } = await api.post('/projects/ideas', { brief: brief.trim(), count: 4 })
      setIdeas(data.data)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setGenerating(false)
    }
  }

  const search = (e: FormEvent) => {
    e.preventDefault()
    void load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Show what you're building, find people to build it with, and get real feedback.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/projects/requests"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Requests
          </Link>
          <Link
            to="/projects/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Post a project
          </Link>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card
        title="Stuck for an idea?"
        description="Proposes projects built on the skills and interests in your profile, each scoped to a first version you could actually finish."
      >
        <Textarea
          rows={2}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Optional: something to build around — a subject, a problem, a technology you want to learn."
          aria-label="What to build around"
        />
        <div className="mt-3">
          <Button onClick={() => void generate()} loading={generating}>
            {ideas ? 'Suggest more ideas' : 'Suggest project ideas'}
          </Button>
        </div>

        {ideas && (
          <div className="mt-4 space-y-3">
            {ideas.noteToStudent && <p className="text-sm text-slate-600">{ideas.noteToStudent}</p>}
            {ideas.ideas.map((idea) => (
              <div key={idea.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-semibold text-slate-900">{idea.title}</h3>
                  <span
                    className={`text-xs font-medium ${DIFFICULTY_TONE[idea.difficulty] ?? 'text-slate-600'}`}
                  >
                    {idea.difficulty} · ~{idea.weeks} weeks
                  </span>
                </div>
                <p className="text-sm text-slate-600">{idea.tagline}</p>

                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">The problem: </span>
                  {idea.problem}
                </p>
                <p className="mt-1 text-sm text-slate-700">{idea.description}</p>
                <p className="mt-1.5 text-sm text-slate-700">
                  <span className="font-medium text-brand-700">Start with: </span>
                  {idea.firstMilestone}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {idea.tech.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                    >
                      {t}
                    </span>
                  ))}
                  <Link
                    to="/projects/new"
                    state={{ idea }}
                    className="ml-auto text-sm font-medium text-brand-600 hover:underline"
                  >
                    Post this →
                  </Link>
                </div>

                {idea.rolesNeeded.length > 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Would need: {idea.rolesNeeded.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1" role="tablist" aria-label="Project views">
          {(['all', 'mine'] as View[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                view === key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {key === 'all' ? 'Browse' : 'Mine'}
            </button>
          ))}
        </nav>
      </div>

      {view === 'all' && (
        <Card>
          <form onSubmit={search} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, taglines, descriptions…"
              aria-label="Search projects"
            />
            <Button type="submit">Search</Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatus('')}
              aria-pressed={status === ''}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === ''
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {meta?.statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s === status ? '' : s)}
                aria-pressed={status === s}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  status === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {STATUS_LABEL[s]} {meta.counts[s] ? `· ${meta.counts[s]}` : ''}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={openTeams}
                onChange={(e) => setOpenTeams(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Looking for teammates{meta?.openTeams ? ` (${meta.openTeams})` : ''}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={sort === 'rated'}
                onChange={(e) => setSort(e.target.checked ? 'rated' : 'recent')}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Best rated first
            </label>
            {tech && (
              <button
                onClick={() => setTech('')}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                tech: {tech} ×
              </button>
            )}
          </div>

          {meta && meta.tech.length > 0 && !tech && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta.tech.slice(0, 15).map((t) => (
                <button
                  key={t}
                  onClick={() => setTech(t)}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500">
            {view === 'mine'
              ? "You haven't posted a project yet, and nobody has added you to one."
              : 'No projects match those filters. Clear them, or post the first one.'}
          </p>
        ) : (
          projects.map((project) => <ProjectCard key={project.id} project={project} />)
        )}
      </div>
    </div>
  )
}
