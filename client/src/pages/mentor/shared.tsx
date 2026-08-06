import type { GoalCategory, GoalStatus } from '../../types'

export const CATEGORY_LABEL: Record<GoalCategory, string> = {
  study: 'Study',
  career: 'Career',
  project: 'Project',
  skill: 'Skill',
  other: 'Other',
}

const CATEGORY_TONE: Record<GoalCategory, string> = {
  study: 'bg-sky-50 text-sky-800 ring-sky-200',
  career: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  project: 'bg-violet-50 text-violet-800 ring-violet-200',
  skill: 'bg-amber-50 text-amber-900 ring-amber-200',
  other: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function CategoryBadge({ category }: { category: GoalCategory }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${CATEGORY_TONE[category]}`}>
      {CATEGORY_LABEL[category]}
    </span>
  )
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Active',
  achieved: 'Achieved',
  paused: 'Paused',
  dropped: 'Dropped',
}

/** Which module an action points at, so the brief can link where the work is. */
export const MODULE_PATH: Record<string, string> = {
  study: '/study',
  career: '/career',
  projects: '/projects',
  resources: '/resources',
  community: '/community',
  mentorship: '/mentorship',
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'slate' }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all ${
          tone === 'brand' ? 'bg-brand-600' : 'bg-slate-400'
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

/**
 * A single number with a label.
 *
 * `value` accepts null so "never graded" can render as an em dash rather than
 * a zero — a zero here would read as a score, which is a different claim.
 */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: number | string | null
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
        {value === null ? <span className="text-slate-300">—</span> : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
