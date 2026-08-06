import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import { Avatar, Stars, formatSlot } from './shared'
import type { MentorProfile, MentorReview, Profile } from '../../types'

/**
 * Turn weekly availability windows into concrete bookable times over the next
 * two weeks. The server is still the authority — it re-checks the window and
 * rejects clashes — this only keeps the student from guessing at valid times.
 */
function upcomingSlots(mentor: MentorProfile, days = 14, cap = 60): Date[] {
  const slots: Date[] = []
  const now = Date.now()

  for (let offset = 0; offset < days; offset++) {
    const day = new Date()
    day.setDate(day.getDate() + offset)
    day.setSeconds(0, 0)

    for (const window of mentor.availability) {
      if (window.day !== day.getDay()) continue

      const [startH, startM] = window.start.split(':').map(Number)
      const [endH, endM] = window.end.split(':').map(Number)

      const cursor = new Date(day)
      cursor.setHours(startH, startM, 0, 0)
      const windowEnd = new Date(day)
      windowEnd.setHours(endH, endM, 0, 0)

      while (cursor.getTime() + mentor.sessionLengthMinutes * 60_000 <= windowEnd.getTime()) {
        if (cursor.getTime() > now) slots.push(new Date(cursor))
        cursor.setMinutes(cursor.getMinutes() + mentor.sessionLengthMinutes)
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime()).slice(0, cap)
}

export function MentorDetail() {
  const { mentorId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [mentor, setMentor] = useState<MentorProfile | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<MentorReview[]>([])
  const [error, setError] = useState('')

  const [slot, setSlot] = useState('')
  const [topic, setTopic] = useState('')
  const [agenda, setAgenda] = useState('')
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState('')

  useEffect(() => {
    api
      .get(`/mentorship/mentors/${mentorId}`)
      .then(({ data }) => {
        setMentor(data.data.mentor)
        setProfile(data.data.profile)
        setReviews(data.data.reviews)
      })
      .catch((err) => setError(unwrapError(err).message))
  }, [mentorId])

  const slots = useMemo(() => (mentor ? upcomingSlots(mentor) : []), [mentor])
  const isSelf = user?.id === mentorId

  const book = async (e: FormEvent) => {
    e.preventDefault()
    if (!slot || !topic.trim()) return
    setError('')
    setBooked('')
    setBooking(true)
    try {
      await api.post('/mentorship/sessions', {
        mentorId,
        scheduledFor: new Date(slot).toISOString(),
        topic: topic.trim(),
        agenda: agenda.trim(),
      })
      setBooked('Request sent. You will see it under My sessions once the mentor replies.')
      setTopic('')
      setAgenda('')
      setSlot('')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setBooking(false)
    }
  }

  if (error && !mentor) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link to="/mentorship" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to mentors
        </Link>
      </div>
    )
  }

  if (!mentor) return <p className="text-sm text-slate-500">Loading mentor…</p>

  return (
    <div className="space-y-5">
      <Link to="/mentorship" className="text-sm font-medium text-brand-600 hover:underline">
        ← All mentors
      </Link>

      <Card>
        <div className="flex flex-wrap gap-4">
          <Avatar name={mentor.user.name} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">{mentor.user.name}</h1>
            <p className="text-slate-600">{mentor.headline}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {[
                [mentor.currentRole, mentor.organisation].filter(Boolean).join(' at '),
                mentor.yearsExperience ? `${mentor.yearsExperience} years' experience` : '',
                mentor.languages.length ? mentor.languages.join(', ') : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Stars value={mentor.ratingAverage} count={mentor.ratingCount} />
              <span className="text-xs text-slate-500">
                {mentor.completedSessions} session{mentor.completedSessions === 1 ? '' : 's'} done
              </span>
            </div>
          </div>
          {!isSelf && (
            <Button variant="secondary" onClick={() => navigate(`/mentorship/chat/${mentorId}`)}>
              Message
            </Button>
          )}
        </div>

        {mentor.bio && <p className="mt-4 text-sm whitespace-pre-wrap text-slate-700">{mentor.bio}</p>}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {mentor.expertise.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
            >
              {tag}
            </span>
          ))}
        </div>

        {profile && (profile.skills.length > 0 || profile.fieldOfStudy) && (
          <p className="mt-3 text-xs text-slate-500">
            Also on their profile: {[profile.fieldOfStudy, ...profile.skills].filter(Boolean).join(' · ')}
          </p>
        )}
      </Card>

      <Card title="Availability" description={`${mentor.sessionLengthMinutes}-minute sessions.`}>
        {mentor.availability.length === 0 ? (
          <p className="text-sm text-slate-500">This mentor has not set any hours yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {mentor.availability.map((window, i) => (
              <li
                key={i}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                {formatSlot(window)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isSelf ? (
        <Alert kind="success">This is how your listing looks to students.</Alert>
      ) : (
        <Card title="Book a session" description="Pick a slot, say what you want out of it.">
          {!mentor.acceptingMentees ? (
            <p className="text-sm text-slate-500">
              This mentor has paused new sessions. You can still send them a message.
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500">
              No open slots in the next two weeks. Message them to ask about other times.
            </p>
          ) : (
            <form onSubmit={book} className="space-y-4">
              <Field label="Slot" hint="Times shown in your local timezone.">
                <Select value={slot} onChange={(e) => setSlot(e.target.value)} required>
                  <option value="">Choose a time…</option>
                  {slots.map((s) => (
                    <option key={s.toISOString()} value={s.toISOString()}>
                      {s.toLocaleString([], {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Topic" hint="One line. This is what they see first.">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Reviewing my API design"
                  required
                />
              </Field>

              <Field label="What you want out of it" hint="Optional, but it makes the session better.">
                <Textarea
                  rows={3}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="I've built the schema but I'm not sure the relations hold up…"
                />
              </Field>

              {booked && <Alert kind="success">{booked}</Alert>}
              {error && <Alert>{error}</Alert>}

              <Button type="submit" loading={booking} disabled={!slot || !topic.trim()}>
                Request session
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card title={`Reviews (${reviews.length})`}>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No reviews yet. Reviews come from students after a completed session.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reviews.map((review) => (
              <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-sm text-amber-500">
                    {'★'.repeat(review.rating)}
                    <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {typeof review.mentee === 'string' ? 'A student' : review.mentee.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && <p className="mt-1 text-sm text-slate-700">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
