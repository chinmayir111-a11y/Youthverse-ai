import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input } from '../../components/ui'
import { FocusBars, shortDay } from './shared'
import type { FocusSession, FocusSummary } from '../../types'

type Phase = 'focus' | 'break'

export function FocusPage() {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [label, setLabel] = useState('')

  const [phase, setPhase] = useState<Phase>('focus')
  const [running, setRunning] = useState(false)
  /** Wall-clock instant the current interval ends. */
  const [endAt, setEndAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(25 * 60)

  const [summary, setSummary] = useState<FocusSummary | null>(null)
  const [recent, setRecent] = useState<FocusSession[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Guards the completion handler against a re-entrant tick firing twice.
  const finishing = useRef(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/wellbeing/focus')
      setSummary(data.data.summary)
      setRecent(data.data.recent)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const record = useCallback(
    async (kind: Phase, minutes: number, forLabel: string) => {
      try {
        await api.post('/wellbeing/focus', { kind, minutes, label: forLabel })
        await load()
      } catch (err) {
        setError(unwrapError(err).message)
      }
    },
    [load],
  )

  /**
   * Ticks off a target timestamp rather than decrementing a counter.
   *
   * setInterval drifts, and browsers throttle it hard in a background tab — a
   * counter would quietly under-count exactly when someone switches away to do
   * the work. Reading the clock each tick means a backgrounded timer is still
   * correct when you come back to it.
   */
  useEffect(() => {
    if (!running || endAt === null) return

    const tick = () => {
      const left = Math.round((endAt - Date.now()) / 1000)
      setRemaining(Math.max(0, left))

      if (left <= 0 && !finishing.current) {
        finishing.current = true
        const finished = phase
        const minutes = finished === 'focus' ? focusMinutes : breakMinutes

        // Only completed intervals are recorded, so the weekly total reflects
        // work that happened rather than timers that were started.
        void record(finished, minutes, finished === 'focus' ? label : '')

        const next: Phase = finished === 'focus' ? 'break' : 'focus'
        const nextMinutes = next === 'focus' ? focusMinutes : breakMinutes

        setPhase(next)
        setRunning(false)
        setEndAt(null)
        setRemaining(nextMinutes * 60)
        setNotice(
          finished === 'focus'
            ? `${minutes} minutes logged. Take the break — it is part of the method, not a reward.`
            : 'Break done. Start the next block when you are ready.',
        )
        finishing.current = false
      }
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [running, endAt, phase, focusMinutes, breakMinutes, label, record])

  const start = () => {
    setNotice('')
    setError('')
    finishing.current = false
    setEndAt(Date.now() + remaining * 1000)
    setRunning(true)
  }

  const pause = () => {
    setRunning(false)
    setEndAt(null)
  }

  const reset = () => {
    setRunning(false)
    setEndAt(null)
    setRemaining((phase === 'focus' ? focusMinutes : breakMinutes) * 60)
  }

  const switchTo = (next: Phase) => {
    setPhase(next)
    setRunning(false)
    setEndAt(null)
    setRemaining((next === 'focus' ? focusMinutes : breakMinutes) * 60)
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const total = (phase === 'focus' ? focusMinutes : breakMinutes) * 60
  const elapsed = total === 0 ? 0 : ((total - remaining) / total) * 100

  return (
    <div className="space-y-6">
      <div>
        <Link to="/wellbeing" className="text-sm font-medium text-brand-600 hover:underline">
          ← Wellbeing
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Focus timer</h1>
        <p className="mt-1 text-sm text-slate-600">
          Work in one block, then stop. Only finished blocks are counted.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <div className="flex flex-wrap gap-1.5">
          {(['focus', 'break'] as Phase[]).map((p) => (
            <button
              key={p}
              onClick={() => switchTo(p)}
              aria-pressed={phase === p}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                phase === p
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'focus' ? 'Focus' : 'Break'}
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <p
            className="text-6xl font-bold text-slate-900 tabular-nums"
            role="timer"
            aria-live="off"
          >
            {mm}:{ss}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {phase === 'focus' ? 'Focus block' : 'Break'}
          </p>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${elapsed}%` }}
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {running ? (
            <Button variant="secondary" onClick={pause}>
              Pause
            </Button>
          ) : (
            <Button onClick={start} disabled={remaining === 0}>
              {remaining === total ? 'Start' : 'Resume'}
            </Button>
          )}
          <Button variant="secondary" onClick={reset}>
            Reset
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Field label="Focus minutes">
            <Input
              type="number"
              min={1}
              max={120}
              value={focusMinutes}
              disabled={running}
              onChange={(e) => {
                const value = Number(e.target.value)
                setFocusMinutes(value)
                if (phase === 'focus' && !running) setRemaining(value * 60)
              }}
            />
          </Field>
          <Field label="Break minutes">
            <Input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              disabled={running}
              onChange={(e) => {
                const value = Number(e.target.value)
                setBreakMinutes(value)
                if (phase === 'break' && !running) setRemaining(value * 60)
              }}
            />
          </Field>
          <Field label="Working on" hint="Optional label for your own review.">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="DBMS revision"
            />
          </Field>
        </div>
      </Card>

      <Card title="This week" description={`${summary?.weekMinutes ?? 0} focused minutes.`}>
        {summary && <FocusBars data={summary.byDay} />}
      </Card>

      <Card title="Recent blocks">
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((session) => (
              <li key={session.id} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    session.kind === 'focus'
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {session.kind}
                </span>
                <span className="text-slate-700">{session.minutes} min</span>
                {session.label && <span className="truncate text-slate-500">{session.label}</span>}
                <span className="ml-auto text-xs text-slate-400">{shortDay(session.day)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
