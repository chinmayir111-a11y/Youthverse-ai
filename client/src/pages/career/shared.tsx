import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, unwrapError } from '../../lib/api'
import type { CareerArtifact, CareerArtifactKind } from '../../types'

/** A 0-100 meter. Colour is a signal, so it steps rather than blending. */
export function ScoreBar({ value, label }: { value: number; label?: string }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)))
  const tone =
    safe >= 75 ? 'bg-emerald-500' : safe >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div>
      <div className="flex items-baseline justify-between">
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
        <span className="text-2xl font-bold text-slate-900 tabular-nums">{safe}</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Score'}
      >
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    good: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    bad: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Section heading used inside generated reports. */
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-sm text-slate-500">Nothing listed.</p>
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Load, generate, and delete the saved reports of one kind.
 *
 * Every generated report is persisted server-side, so the page always opens on
 * the most recent one rather than an empty state the student has to re-pay for.
 */
export function useArtifacts<P>(kind: CareerArtifactKind, generatePath: string) {
  const [history, setHistory] = useState<CareerArtifact<P>[]>([])
  const [current, setCurrent] = useState<CareerArtifact<P> | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get('/career/artifacts', { params: { kind } })
      .then(({ data }) => {
        if (cancelled) return
        const list: CareerArtifact<P>[] = data.data.artifacts
        setHistory(list)
        setCurrent(list[0] ?? null)
      })
      .catch((err) => !cancelled && setError(unwrapError(err).message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [kind])

  const generate = useCallback(
    async (body: Record<string, unknown>) => {
      setError('')
      setBusy(true)
      try {
        const { data } = await api.post(generatePath, body)
        const artifact: CareerArtifact<P> = data.data.artifact
        setHistory((prev) => [artifact, ...prev])
        setCurrent(artifact)
        return artifact
      } catch (err) {
        setError(unwrapError(err).message)
        return null
      } finally {
        setBusy(false)
      }
    },
    [generatePath],
  )

  const remove = useCallback(
    async (id: string) => {
      setError('')
      try {
        await api.delete(`/career/artifacts/${id}`)
        setHistory((prev) => {
          const next = prev.filter((a) => a.id !== id)
          setCurrent((c) => (c?.id === id ? (next[0] ?? null) : c))
          return next
        })
      } catch (err) {
        setError(unwrapError(err).message)
      }
    },
    [],
  )

  return { history, current, setCurrent, loading, busy, error, setError, generate, remove }
}

/** The "previous reports" strip shown under each generator. */
export function HistoryStrip<P>({
  history,
  current,
  onSelect,
  onDelete,
}: {
  history: CareerArtifact<P>[]
  current: CareerArtifact<P> | null
  onSelect: (a: CareerArtifact<P>) => void
  onDelete: (id: string) => void
}) {
  if (history.length <= 1) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Earlier:</span>
      {history.map((a) => (
        <span
          key={a.id}
          className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs ${
            a.id === current?.id
              ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <button onClick={() => onSelect(a)} className="font-medium hover:underline">
            {a.title}
          </button>
          <button
            onClick={() => onDelete(a.id)}
            aria-label={`Delete ${a.title}`}
            className="rounded-full px-1 text-slate-400 hover:bg-white hover:text-red-600"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
