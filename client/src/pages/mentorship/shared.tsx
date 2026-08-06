import { Link } from 'react-router-dom'
import type { AvailabilitySlot, MentorProfile, SessionStatus } from '../../types'

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const STATUS_LABEL: Record<SessionStatus, string> = {
  requested: 'Awaiting reply',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export const STATUS_TONE: Record<SessionStatus, string> = {
  requested: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  declined: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-500',
  completed: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
}

export function StatusPill({ status }: { status: SessionStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Stars({ value, count }: { value: number; count: number }) {
  if (!count) return <span className="text-xs text-slate-500">No reviews yet</span>

  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="text-sm text-amber-500">
        {'★'.repeat(rounded)}
        <span className="text-slate-300">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="text-xs text-slate-600">
        {value.toFixed(1)} · {count} review{count === 1 ? '' : 's'}
      </span>
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm'
  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700 ${dims}`}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export function formatSlot(slot: AvailabilitySlot) {
  return `${DAY_NAMES[slot.day]} ${slot.start}–${slot.end}`
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** The card used in the directory and in AI match results. */
export function MentorCard({
  mentor,
  footer,
}: {
  mentor: MentorProfile
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <div className="flex gap-3">
        <Avatar name={mentor.user.name} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/mentorship/mentors/${mentor.user.id}`}
            className="font-semibold text-slate-900 hover:text-brand-700"
          >
            {mentor.user.name}
          </Link>
          <p className="text-sm text-slate-600">{mentor.headline}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[
              [mentor.currentRole, mentor.organisation].filter(Boolean).join(' at '),
              mentor.yearsExperience ? `${mentor.yearsExperience} yrs` : '',
              `${mentor.sessionLengthMinutes}-min sessions`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {mentor.expertise.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Stars value={mentor.ratingAverage} count={mentor.ratingCount} />
            {!mentor.acceptingMentees && (
              <span className="text-xs font-medium text-slate-500">Not taking new sessions</span>
            )}
          </div>

          {footer}
        </div>
      </div>
    </div>
  )
}
