import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Input } from '../../components/ui'
import { MentorCard, formatWhen } from './shared'
import type { MentorMatch, MentorProfile, MentorshipOverview } from '../../types'

export function MentorshipHome() {
  const [mentors, setMentors] = useState<MentorProfile[]>([])
  const [expertise, setExpertise] = useState<string[]>([])
  const [activeTag, setActiveTag] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [overview, setOverview] = useState<MentorshipOverview | null>(null)

  const [goal, setGoal] = useState('')
  const [matches, setMatches] = useState<MentorMatch[] | null>(null)
  const [matchNote, setMatchNote] = useState('')
  const [matching, setMatching] = useState(false)

  const load = async (params: { q?: string; expertise?: string } = {}) => {
    setError('')
    try {
      const { data } = await api.get('/mentorship/mentors', { params })
      setMentors(data.data.mentors)
      setExpertise(data.data.expertise)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    api
      .get('/mentorship/overview')
      .then(({ data }) => setOverview(data.data))
      .catch(() => {
        /* the directory still works without the summary strip */
      })
  }, [])

  const search = (e: FormEvent) => {
    e.preventDefault()
    void load({ q: query.trim(), expertise: activeTag })
  }

  const filterBy = (tag: string) => {
    const next = tag === activeTag ? '' : tag
    setActiveTag(next)
    void load({ q: query.trim(), expertise: next })
  }

  const findMatches = async () => {
    setError('')
    setMatching(true)
    try {
      const { data } = await api.post('/mentorship/match', { goal: goal.trim() })
      setMatches(data.data.matches)
      setMatchNote(data.data.noteToStudent ?? '')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentorship</h1>
          <p className="mt-1 text-sm text-slate-600">
            Find someone who has done the thing you're trying to do, and book time with them.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/mentorship/sessions"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            My sessions
            {overview?.sessions.byStatus.requested ? ` (${overview.sessions.byStatus.requested})` : ''}
          </Link>
          <Link
            to="/mentorship/chat"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Messages{overview?.unreadMessages ? ` (${overview.unreadMessages})` : ''}
          </Link>
          {overview?.canMentor && (
            <Link
              to="/mentorship/me"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              My mentor listing
            </Link>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {overview?.nextSessionAt && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          Next confirmed session: <strong>{formatWhen(overview.nextSessionAt)}</strong>{' '}
          <Link to="/mentorship/sessions" className="font-medium underline">
            view
          </Link>
        </div>
      )}

      <Card
        title="Find my match"
        description="Ranks the available mentors against your profile and what you need right now."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do you want help with? e.g. getting a backend internship"
              aria-label="What do you want help with"
            />
          </div>
          <Button onClick={() => void findMatches()} loading={matching}>
            Find my match
          </Button>
        </div>

        {matches && (
          <div className="mt-4 space-y-3">
            {matchNote && <p className="text-sm text-slate-600">{matchNote}</p>}
            {matches.length === 0 ? (
              <p className="text-sm text-slate-500">No strong matches right now.</p>
            ) : (
              matches.map((match) => (
                <MentorCard
                  key={match.mentorId}
                  mentor={match.mentor}
                  footer={
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-brand-700">{match.fit}% fit</p>
                      <p className="mt-0.5 text-slate-700">{match.why}</p>
                      <p className="mt-1.5 text-slate-600">
                        <span className="font-medium text-slate-700">Open with: </span>
                        {match.askThemAbout}
                      </p>
                    </div>
                  }
                />
              ))
            )}
          </div>
        )}
      </Card>

      <Card title="Browse mentors">
        <form onSubmit={search} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, expertise, or what they write about…"
            aria-label="Search mentors"
          />
          <Button type="submit">Search</Button>
        </form>

        {expertise.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {expertise.map((tag) => (
              <button
                key={tag}
                onClick={() => filterBy(tag)}
                aria-pressed={activeTag === tag}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeTag === tag
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading mentors…</p>
          ) : mentors.length === 0 ? (
            <p className="text-sm text-slate-500">
              No mentors match that. Clear the filters, or check back — listings are published by
              mentors themselves.
            </p>
          ) : (
            mentors.map((mentor) => <MentorCard key={mentor.id} mentor={mentor} />)
          )}
        </div>
      </Card>
    </div>
  )
}
