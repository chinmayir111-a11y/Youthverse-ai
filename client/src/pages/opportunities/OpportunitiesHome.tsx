import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Input } from '../../components/ui'
import { OpportunityCard, TYPE_LABEL } from './shared'
import type { Opportunity, OpportunityMeta, OpportunityPick } from '../../types'

type View = 'all' | 'saved'

export function OpportunitiesHome() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [meta, setMeta] = useState<OpportunityMeta | null>(null)
  const [view, setView] = useState<View>('all')
  const [type, setType] = useState('')
  const [tag, setTag] = useState('')
  const [remote, setRemote] = useState(false)
  const [closingSoon, setClosingSoon] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [picks, setPicks] = useState<OpportunityPick[] | null>(null)
  const [pickNote, setPickNote] = useState('')
  const [recommending, setRecommending] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      if (view === 'saved') {
        const { data } = await api.get('/opportunities/me/saved')
        setOpportunities(data.data.opportunities)
      } else {
        const params: Record<string, string> = {}
        if (type) params.type = type
        if (tag) params.tag = tag
        if (remote) params.remote = 'true'
        if (closingSoon) params.closingInDays = '7'
        if (query.trim()) params.q = query.trim()

        const { data } = await api.get('/opportunities', { params })
        setOpportunities(data.data.opportunities)
      }
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [view, type, tag, remote, closingSoon, query])

  // `query` is deliberately not a dependency of the auto-load: search runs on
  // submit, while the chips and toggles apply immediately.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, type, tag, remote, closingSoon])

  useEffect(() => {
    api
      .get('/opportunities/meta')
      .then(({ data }) => setMeta(data.data))
      .catch(() => {
        /* the list still works without the filter counts */
      })
  }, [])

  const toggleSave = async (opportunity: Opportunity) => {
    const next = !opportunity.saved
    // Flip locally first; the list is re-fetched only in the saved view, where
    // the row has to disappear.
    setOpportunities((prev) =>
      prev.map((o) => (o.id === opportunity.id ? { ...o, saved: next } : o)),
    )
    try {
      if (next) await api.post(`/opportunities/${opportunity.id}/save`)
      else await api.delete(`/opportunities/${opportunity.id}/save`)
      if (view === 'saved') void load()
    } catch (err) {
      setError(unwrapError(err).message)
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opportunity.id ? { ...o, saved: !next } : o)),
      )
    }
  }

  const recommend = async () => {
    setError('')
    setRecommending(true)
    try {
      const { data } = await api.post('/opportunities/recommend')
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
          <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-600">
            Internships, scholarships, hackathons, and everything else worth your time.
          </p>
        </div>
        <Link
          to="/opportunities/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Post an opportunity
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card
        title="Picked for you"
        description="Shortlists the open listings against your profile, and names the catch in each."
      >
        <Button onClick={() => void recommend()} loading={recommending}>
          {picks ? 'Refresh shortlist' : 'Build my shortlist'}
        </Button>

        {picks && (
          <div className="mt-4 space-y-3">
            {pickNote && <p className="text-sm text-slate-600">{pickNote}</p>}
            {picks.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing open is a strong fit right now.</p>
            ) : (
              picks.map((pick) => (
                <OpportunityCard
                  key={pick.opportunityId}
                  opportunity={pick.opportunity}
                  onToggleSave={toggleSave}
                  footer={
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-brand-700">{pick.fit}% fit</p>
                      <p className="mt-0.5 text-slate-700">{pick.why}</p>
                      <p className="mt-1.5 text-slate-600">
                        <span className="font-medium text-amber-700">Watch out: </span>
                        {pick.watchOut}
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
        <nav className="-mb-px flex gap-1" role="tablist" aria-label="Opportunity views">
          {(['all', 'saved'] as View[]).map((key) => (
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
              {key === 'all' ? 'Browse' : 'Saved'}
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
              placeholder="Search titles, organisations, descriptions…"
              aria-label="Search opportunities"
            />
            <Button type="submit">Search</Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setType('')}
              aria-pressed={type === ''}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                type === '' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  type === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Remote only
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={closingSoon}
                onChange={(e) => setClosingSoon(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Closing within 7 days{meta?.closingSoon ? ` (${meta.closingSoon})` : ''}
            </label>
            {tag && (
              <button
                onClick={() => setTag('')}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                tag: {tag} ×
              </button>
            )}
          </div>

          {meta && meta.tags.length > 0 && !tag && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta.tags.slice(0, 15).map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
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
        ) : opportunities.length === 0 ? (
          <p className="text-sm text-slate-500">
            {view === 'saved'
              ? 'Nothing saved yet. Hit Save on anything worth coming back to.'
              : 'No opportunities match those filters. Clear them, or post the first one.'}
          </p>
        ) : (
          opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              onToggleSave={toggleSave}
            />
          ))
        )}
      </div>
    </div>
  )
}
