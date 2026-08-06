import { Link } from 'react-router-dom'
import type { Opportunity, OpportunityType } from '../../types'

export const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: 'Internships',
  scholarship: 'Scholarships',
  hackathon: 'Hackathons',
  competition: 'Competitions',
  workshop: 'Workshops',
  webinar: 'Webinars',
  event: 'Events',
}

/** Singular form, for a single card or the detail page. */
export const TYPE_ONE: Record<OpportunityType, string> = {
  internship: 'Internship',
  scholarship: 'Scholarship',
  hackathon: 'Hackathon',
  competition: 'Competition',
  workshop: 'Workshop',
  webinar: 'Webinar',
  event: 'Event',
}

const TYPE_TONE: Record<OpportunityType, string> = {
  internship: 'bg-sky-50 text-sky-800 ring-sky-200',
  scholarship: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  hackathon: 'bg-violet-50 text-violet-800 ring-violet-200',
  competition: 'bg-amber-50 text-amber-900 ring-amber-200',
  workshop: 'bg-rose-50 text-rose-800 ring-rose-200',
  webinar: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  event: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function TypeBadge({ type }: { type: OpportunityType }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${TYPE_TONE[type]}`}>
      {TYPE_ONE[type]}
    </span>
  )
}

/**
 * How long is left, said the way a person would.
 * Urgency drives the colour, so "closes tomorrow" cannot read as calm.
 */
export function Deadline({ opportunity }: { opportunity: Opportunity }) {
  if (!opportunity.deadline) {
    return <span className="text-xs text-slate-500">No stated deadline</span>
  }

  const { daysLeft, expired } = opportunity
  const date = new Date(opportunity.deadline).toLocaleDateString()

  if (expired) return <span className="text-xs font-medium text-slate-400">Closed · {date}</span>

  const text =
    daysLeft === 0 ? 'Closes today' : daysLeft === 1 ? 'Closes tomorrow' : `${daysLeft} days left`
  const tone =
    (daysLeft ?? 99) <= 3 ? 'text-red-600' : (daysLeft ?? 99) <= 7 ? 'text-amber-700' : 'text-slate-500'

  return (
    <span className={`text-xs font-medium ${tone}`}>
      {text} · {date}
    </span>
  )
}

export function OpportunityCard({
  opportunity,
  onToggleSave,
  footer,
}: {
  opportunity: Opportunity
  onToggleSave?: (opportunity: Opportunity) => void
  footer?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition hover:border-brand-300 ${
        opportunity.expired ? 'border-slate-200 opacity-70' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <TypeBadge type={opportunity.type} />
        {opportunity.isRemote && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Remote
          </span>
        )}
        {opportunity.tracked && (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            In your tracker
          </span>
        )}
        <span className="ml-auto">
          <Deadline opportunity={opportunity} />
        </span>
      </div>

      <Link
        to={`/opportunities/${opportunity.id}`}
        className="mt-2 block font-semibold text-slate-900 hover:text-brand-700"
      >
        {opportunity.title}
      </Link>
      <p className="text-sm text-slate-600">
        {opportunity.organisation}
        {opportunity.location && !opportunity.isRemote ? ` · ${opportunity.location}` : ''}
        {opportunity.reward ? ` · ${opportunity.reward}` : ''}
      </p>

      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{opportunity.description}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {opportunity.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
          >
            {tag}
          </span>
        ))}
        {onToggleSave && (
          <button
            onClick={() => onToggleSave(opportunity)}
            aria-pressed={opportunity.saved}
            aria-label={opportunity.saved ? `Unsave ${opportunity.title}` : `Save ${opportunity.title}`}
            className={`ml-auto rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              opportunity.saved
                ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opportunity.saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>

      {footer}
    </div>
  )
}
