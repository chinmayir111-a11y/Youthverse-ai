import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Select, Textarea } from '../../components/ui'
import { Avatar, StatusPill, formatWhen } from './shared'
import type { MentorshipSession, SessionStatus } from '../../types'

/**
 * What each side may do next. Mirrors the server's transition table — the
 * server still enforces it, this only decides which buttons to draw.
 */
const actionsFor = (session: MentorshipSession): { label: string; status: SessionStatus; danger?: boolean }[] => {
  const mine = session.myRole
  if (session.status === 'requested') {
    return mine === 'mentor'
      ? [
          { label: 'Accept', status: 'confirmed' },
          { label: 'Decline', status: 'declined', danger: true },
        ]
      : [{ label: 'Withdraw', status: 'cancelled', danger: true }]
  }
  if (session.status === 'confirmed') {
    const actions: { label: string; status: SessionStatus; danger?: boolean }[] = [
      { label: 'Cancel', status: 'cancelled', danger: true },
    ]
    if (mine === 'mentor') actions.unshift({ label: 'Mark complete', status: 'completed' })
    return actions
  }
  return []
}

function ReviewForm({
  session,
  onDone,
}: {
  session: MentorshipSession
  onDone: () => void
}) {
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSaving(true)
    try {
      await api.post(`/mentorship/sessions/${session.id}/review`, {
        rating: Number(rating),
        comment: comment.trim(),
      })
      onDone()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">How was it?</p>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Rating">
          <Select value={rating} onChange={(e) => setRating(e.target.value)}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)} ({n})
              </option>
            ))}
          </Select>
        </Field>
        <div className="min-w-[16rem] flex-1">
          <Field label="Comment">
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was useful? What would have made it better?"
            />
          </Field>
        </div>
        <Button onClick={() => void submit()} loading={saving}>
          Submit review
        </Button>
      </div>
    </div>
  )
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try {
      const { data } = await api.get('/mentorship/sessions')
      setSessions(data.data.sessions)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const move = async (session: MentorshipSession, status: SessionStatus) => {
    const needsReason = status === 'declined' || status === 'cancelled'
    const reason = needsReason ? window.prompt('Add a short reason (optional):') ?? '' : ''

    setError('')
    setBusy(session.id)
    try {
      const { data } = await api.patch(`/mentorship/sessions/${session.id}`, { status, reason })
      const updated: MentorshipSession = data.data.session
      setSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated, myRole: s.myRole } : s)),
      )
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setBusy(null)
    }
  }

  const live = sessions.filter((s) => s.status === 'requested' || s.status === 'confirmed')
  const past = sessions.filter((s) => !live.includes(s))

  const row = (session: MentorshipSession) => {
    const other = session.myRole === 'mentor' ? session.mentee : session.mentor
    const actions = actionsFor(session)

    return (
      <li key={session.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={other.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{session.topic}</span>
              <StatusPill status={session.status} />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                you are the {session.myRole}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              with {other.name} · {formatWhen(session.scheduledFor)} · {session.durationMinutes} min
            </p>
            {session.agenda && <p className="mt-1 text-sm text-slate-600">{session.agenda}</p>}
            {session.statusReason && (
              <p className="mt-1 text-sm text-slate-500">Reason: {session.statusReason}</p>
            )}
            {session.meetingLink && session.status === 'confirmed' && (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Join the meeting →
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to={`/mentorship/chat/${other.id}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Message
            </Link>
            {actions.map((action) => (
              <Button
                key={action.status}
                variant={action.danger ? 'secondary' : 'primary'}
                loading={busy === session.id}
                onClick={() => void move(session, action.status)}
              >
                {action.label}
              </Button>
            ))}
            {session.status === 'completed' && session.myRole === 'mentee' && !session.reviewed && (
              <Button variant="secondary" onClick={() => setReviewing(session.id)}>
                Leave a review
              </Button>
            )}
            {session.reviewed && <span className="self-center text-xs text-slate-500">Reviewed</span>}
          </div>
        </div>

        {reviewing === session.id && (
          <ReviewForm
            session={session}
            onDone={() => {
              setReviewing(null)
              void load()
            }}
          />
        )}
      </li>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My sessions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Requests you've sent and sessions you've been asked for, in one list.
          </p>
        </div>
        <Link
          to="/mentorship"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Find a mentor
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="Upcoming and pending">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : live.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing scheduled. Find a mentor and request a slot.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">{live.map(row)}</ul>
        )}
      </Card>

      {past.length > 0 && (
        <Card title="Past and closed">
          <ul className="divide-y divide-slate-100">{past.map(row)}</ul>
        </Card>
      )}
    </div>
  )
}
