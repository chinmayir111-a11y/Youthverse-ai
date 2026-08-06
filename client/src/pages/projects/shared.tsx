import { Link } from 'react-router-dom'
import type { CollaborationStatus, Project, ProjectStatus, UserRef } from '../../types'

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'Ideas',
  building: 'Building',
  beta: 'In beta',
  shipped: 'Shipped',
}

/** Singular form, for a single card or the detail page. */
export const STATUS_ONE: Record<ProjectStatus, string> = {
  idea: 'Idea',
  building: 'Building',
  beta: 'Beta',
  shipped: 'Shipped',
}

const STATUS_TONE: Record<ProjectStatus, string> = {
  idea: 'bg-slate-100 text-slate-700 ring-slate-200',
  building: 'bg-amber-50 text-amber-900 ring-amber-200',
  beta: 'bg-violet-50 text-violet-800 ring-violet-200',
  shipped: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_TONE[status]}`}>
      {STATUS_ONE[status]}
    </span>
  )
}

export const REQUEST_TONE: Record<CollaborationStatus, string> = {
  pending: 'bg-amber-50 text-amber-900 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  declined: 'bg-slate-100 text-slate-600 ring-slate-200',
  withdrawn: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function RequestBadge({ status }: { status: CollaborationStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${REQUEST_TONE[status]}`}>
      {status}
    </span>
  )
}

/** Owner and collaborators are populated on reads but can be bare ids elsewhere. */
export function userOf(value: UserRef | string): UserRef | null {
  return typeof value === 'string' ? null : value
}

/**
 * A rating, said the way a person would.
 *
 * "Not yet rated" rather than a row of empty stars: an unrated project is
 * unknown, and five hollow stars read as a bad score.
 */
export function Stars({ average, count }: { average: number; count: number }) {
  if (count === 0) return <span className="text-xs text-slate-500">Not yet rated</span>

  return (
    <span className="text-xs font-medium text-slate-600">
      <span aria-hidden="true" className="text-amber-500">
        {'★'.repeat(Math.round(average))}
        {'☆'.repeat(5 - Math.round(average))}
      </span>{' '}
      {average.toFixed(1)} · {count} review{count === 1 ? '' : 's'}
    </span>
  )
}

/** The 1-5 picker used when leaving feedback. */
export function StarPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className={`rounded px-1.5 text-2xl leading-none transition ${
            n <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function ProjectCard({ project, footer }: { project: Project; footer?: React.ReactNode }) {
  const owner = userOf(project.owner)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <div className="flex flex-wrap items-start gap-2">
        <StatusBadge status={project.status} />
        {project.lookingForTeammates && (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            Looking for teammates
          </span>
        )}
        {project.isCollaborator && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            You're on this team
          </span>
        )}
        <span className="ml-auto">
          <Stars average={project.ratingAverage} count={project.ratingCount} />
        </span>
      </div>

      <Link
        to={`/projects/${project.id}`}
        className="mt-2 block font-semibold text-slate-900 hover:text-brand-700"
      >
        {project.title}
      </Link>
      {project.tagline && <p className="text-sm text-slate-600">{project.tagline}</p>}

      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{project.description}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {project.tech.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
          >
            {t}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {owner?.name ?? 'A member'}
          {project.collaborators.length > 0 && ` +${project.collaborators.length}`}
        </span>
      </div>

      {footer}
    </div>
  )
}
