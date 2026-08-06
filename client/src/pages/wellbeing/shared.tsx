import type { MoodFactor, SupportSignal } from '../../types'

export const MOOD_LABEL: Record<number, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}

/**
 * A sequential single-hue ramp from the brand scale, light → dark, rather than
 * the usual red-to-green.
 *
 * Two reasons. It varies in lightness rather than hue, so it survives every
 * kind of colour blindness by construction (validated: strictly monotonic
 * OKLab lightness, 0.60 total range). And red-for-a-bad-day paints a low mood
 * as an error state, which is the one thing this module should not do.
 *
 * The two lightest steps fall below 3:1 against the page, so every mood mark
 * also carries its number — colour never carries the value alone.
 */
const MOOD_FILL: Record<number, string> = {
  1: 'bg-brand-100',
  2: 'bg-brand-300',
  3: 'bg-brand-400',
  4: 'bg-brand-600',
  5: 'bg-brand-900',
}

/** Ink that stays legible as the fill darkens. */
const MOOD_INK: Record<number, string> = {
  1: 'text-brand-900',
  2: 'text-brand-900',
  3: 'text-white',
  4: 'text-white',
  5: 'text-white',
}

export function MoodDot({ mood, size = 'md' }: { mood: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-grid place-items-center rounded font-semibold tabular-nums ${
        size === 'sm' ? 'h-6 w-6 text-xs' : 'h-9 w-9 text-sm'
      } ${MOOD_FILL[mood]} ${MOOD_INK[mood]}`}
      title={`${mood}/5 — ${MOOD_LABEL[mood]}`}
    >
      {mood}
    </span>
  )
}

export const FACTOR_LABEL: Record<MoodFactor, string> = {
  sleep: 'Sleep',
  workload: 'Workload',
  exams: 'Exams',
  health: 'Health',
  social: 'Social',
  family: 'Family',
  money: 'Money',
  other: 'Other',
}

export const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** "2026-08-06" → "6 Aug", without constructing a Date in the wrong zone. */
export function shortDay(key: string): string {
  const [, month, day] = key.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[month - 1]}`
}

/**
 * Focus minutes per day.
 *
 * One series, so no legend — the card title names it. Bars are anchored to the
 * baseline with rounded data-ends, separated by a surface gap, and each carries
 * its own hover label; the axis is a single recessive rule rather than a grid.
 */
export function FocusBars({ data }: { data: { day: string; minutes: number }[] }) {
  const peak = Math.max(60, ...data.map((d) => d.minutes))

  return (
    <div>
      <div className="flex h-28 items-end gap-2">
        {data.map((point) => {
          const height = point.minutes === 0 ? 0 : Math.max(4, (point.minutes / peak) * 100)
          return (
            <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end">
                {point.minutes === 0 ? (
                  <div
                    className="h-0.5 w-full rounded-full bg-slate-200"
                    title={`${shortDay(point.day)}: nothing logged`}
                  />
                ) : (
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${height}%` }}
                    title={`${shortDay(point.day)}: ${point.minutes} minutes`}
                  />
                )}
              </div>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {point.minutes || ''}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1 h-px bg-slate-200" />
      <div className="mt-1 flex gap-2">
        {data.map((point) => (
          <span key={point.day} className="min-w-0 flex-1 text-center text-[10px] text-slate-500">
            {shortDay(point.day).split(' ')[0]}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Shown when the log suggests a run of hard days rather than one bad one.
 *
 * Deliberately quiet: it states what was noticed, says a person helps more than
 * an app, and stops. No diagnosis, no urgency, nothing withheld or unlocked.
 */
export function SupportNote({ support }: { support: SupportSignal }) {
  if (!support.suggested) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="font-medium text-amber-900">This looks like more than one hard week.</p>
      {support.reason && <p className="mt-1 text-sm text-amber-900">{support.reason}</p>}
      <p className="mt-2 text-sm text-amber-900">
        Talking to someone will do more than anything on this page.
        {support.contact ? (
          <>
            {' '}
            Here, that's <span className="font-medium">{support.contact}</span>.
          </>
        ) : (
          <>
            {' '}
            That might be someone you trust, your institution's counselling service, or a doctor.
          </>
        )}
      </p>
      <p className="mt-2 text-xs text-amber-800">
        Only you can see this. Nothing here is shared with anyone.
      </p>
    </div>
  )
}
