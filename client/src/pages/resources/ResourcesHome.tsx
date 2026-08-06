import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Input } from '../../components/ui'
import { ResourceCard, TYPE_LABEL } from './shared'
import type { Resource, ResourceMeta, ResourcePick } from '../../types'

type View = 'all' | 'saved' | 'mine'

export function ResourcesHome() {
  const [resources, setResources] = useState<Resource[]>([])
  const [meta, setMeta] = useState<ResourceMeta | null>(null)
  const [view, setView] = useState<View>('all')
  const [type, setType] = useState('')
  const [subject, setSubject] = useState('')
  const [filesOnly, setFilesOnly] = useState(false)
  const [sort, setSort] = useState<'recent' | 'helpful'>('recent')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [goal, setGoal] = useState('')
  const [picks, setPicks] = useState<ResourcePick[] | null>(null)
  const [pickNote, setPickNote] = useState('')
  const [recommending, setRecommending] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const path =
        view === 'saved' ? '/resources/me/saved' : view === 'mine' ? '/resources/me' : '/resources'

      const params: Record<string, string> = {}
      if (view === 'all') {
        if (type) params.type = type
        if (subject) params.subject = subject
        if (filesOnly) params.hasFile = 'true'
        if (sort === 'helpful') params.sort = 'helpful'
        if (query.trim()) params.q = query.trim()
      }

      const { data } = await api.get(path, { params })
      setResources(data.data.resources)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [view, type, subject, filesOnly, sort, query])

  // `query` is deliberately not a dependency of the auto-load: search runs on
  // submit, while the chips and toggles apply immediately.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, type, subject, filesOnly, sort])

  useEffect(() => {
    api
      .get('/resources/meta')
      .then(({ data }) => setMeta(data.data))
      .catch(() => {
        /* the list still works without the filter counts */
      })
  }, [])

  const vote = async (resource: Resource, value: number) => {
    // Flip locally first so the arrow responds immediately; the server's
    // recomputed score replaces it on success.
    const previous = resources
    setResources((prev) =>
      prev.map((r) =>
        r.id === resource.id
          ? { ...r, myVote: value, score: r.score - r.myVote + value }
          : r,
      ),
    )
    try {
      const { data } = await api.post(`/resources/${resource.id}/vote`, { value })
      setResources((prev) => prev.map((r) => (r.id === resource.id ? data.data.resource : r)))
    } catch (err) {
      setError(unwrapError(err).message)
      setResources(previous)
    }
  }

  const toggleSave = async (resource: Resource) => {
    const next = !resource.saved
    setResources((prev) =>
      prev.map((r) => (r.id === resource.id ? { ...r, saved: next } : r)),
    )
    try {
      if (next) await api.post(`/resources/${resource.id}/save`)
      else await api.delete(`/resources/${resource.id}/save`)
      if (view === 'saved') void load()
    } catch (err) {
      setError(unwrapError(err).message)
      setResources((prev) =>
        prev.map((r) => (r.id === resource.id ? { ...r, saved: !next } : r)),
      )
    }
  }

  const recommend = async () => {
    setError('')
    setRecommending(true)
    try {
      const { data } = await api.post('/resources/recommend', { goal: goal.trim() })
      setPicks(data.data.picks)
      setPickNote(data.data.noteToStudent ?? '')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setRecommending(false)
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
          <h1 className="text-2xl font-bold text-slate-900">Resources</h1>
          <p className="mt-1 text-sm text-slate-600">
            Notes, past papers, templates, and cheat sheets, shared by people who sat the same
            exams.
          </p>
        </div>
        <Link
          to="/resources/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Share a resource
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card
        title="What should I read?"
        description="Shortlists the library against your profile and says how to work through each one."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void recommend()
          }}
          className="flex gap-2"
        >
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Optional: what you're working on — 'DBMS exam next week', 'SDE interviews'"
            aria-label="What you're working on"
          />
          <Button type="submit" loading={recommending}>
            {picks ? 'Refresh' : 'Shortlist'}
          </Button>
        </form>

        {picks && (
          <div className="mt-4 space-y-3">
            {pickNote && <p className="text-sm text-slate-600">{pickNote}</p>}
            {picks.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing in the library fits that right now.</p>
            ) : (
              picks.map((pick) => (
                <ResourceCard
                  key={pick.resourceId}
                  resource={pick.resource}
                  onToggleSave={toggleSave}
                  footer={
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-brand-700">{pick.relevance}% match</p>
                      <p className="mt-0.5 text-slate-700">{pick.why}</p>
                      <p className="mt-1.5 text-slate-600">
                        <span className="font-medium text-slate-700">How to use it: </span>
                        {pick.howToUse}
                      </p>
                    </div>
                  }
                />
              ))
            )}
          </div>
        )}
      </Card>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1" role="tablist" aria-label="Resource views">
          {(['all', 'saved', 'mine'] as View[]).map((key) => (
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
              {key === 'all' ? 'Browse' : key === 'saved' ? 'Saved' : 'Mine'}
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
              placeholder="Search titles, descriptions, subjects…"
              aria-label="Search resources"
            />
            <Button type="submit">Search</Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setType('')}
              aria-pressed={type === ''}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                type === ''
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {meta?.types.map((t) => (
              <button
                key={t}
                onClick={() => setType(t === type ? '' : t)}
                aria-pressed={type === t}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  type === t
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {TYPE_LABEL[t]} {meta.counts[t] ? `· ${meta.counts[t]}` : ''}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filesOnly}
                onChange={(e) => setFilesOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Downloadable only{meta?.withFiles ? ` (${meta.withFiles})` : ''}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={sort === 'helpful'}
                onChange={(e) => setSort(e.target.checked ? 'helpful' : 'recent')}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Most helpful first
            </label>
            {subject && (
              <button
                onClick={() => setSubject('')}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                subject: {subject} ×
              </button>
            )}
          </div>

          {meta && meta.subjects.length > 0 && !subject && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta.subjects.slice(0, 15).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resources.length === 0 ? (
          <p className="text-sm text-slate-500">
            {view === 'saved'
              ? 'Nothing saved yet. Hit Save on anything worth coming back to.'
              : view === 'mine'
                ? "You haven't shared anything yet. The notes you already have are worth more to someone else than to you."
                : 'No resources match those filters. Clear them, or share the first one.'}
          </p>
        ) : (
          resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onVote={vote}
              onToggleSave={toggleSave}
            />
          ))
        )}
      </div>
    </div>
  )
}
