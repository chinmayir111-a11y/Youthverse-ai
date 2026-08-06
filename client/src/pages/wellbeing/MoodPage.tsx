import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Select } from '../../components/ui'
import { FACTOR_LABEL, MOOD_LABEL, MoodDot, SupportNote, shortDay } from './shared'
import type { MoodEntry, MoodStats, SupportSignal, WellbeingCheckin } from '../../types'

export function MoodPage() {
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [stats, setStats] = useState<MoodStats | null>(null)
  const [support, setSupport] = useState<SupportSignal | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [checkin, setCheckin] = useState<WellbeingCheckin | null>(null)
  const [reading, setReading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/wellbeing/mood', { params: { days } })
      setEntries(data.data.entries)
      setStats(data.data.stats)
      setSupport(data.data.support)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const readBack = async () => {
    setError('')
    setReading(true)
    try {
      const { data } = await api.post('/wellbeing/checkin')
      setCheckin(data.data.checkin)
      setSupport(data.data.support)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setReading(false)
    }
  }

  const remove = async (day: string) => {
    if (!window.confirm(`Delete your entry for ${shortDay(day)}?`)) return
    try {
      await api.delete(`/wellbeing/mood/${day}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  // Newest first for reading; the trend row below stays chronological.
  const newest = [...entries].reverse()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/wellbeing" className="text-sm font-medium text-brand-600 hover:underline">
            ← Wellbeing
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Mood history</h1>
          <p className="mt-1 text-sm text-slate-600">Only you can see any of this.</p>
        </div>
        <Select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-auto"
          aria-label="Time range"
        >
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}
      {support && <SupportNote support={support} />}

      {stats && stats.entries > 0 && (
        <Card title="The shape of it">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Logged</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{stats.entries}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Average mood
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                {stats.averageMood ?? '—'}
                <span className="text-base font-normal text-slate-400">/5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Average sleep
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                {stats.averageSleep ?? <span className="text-slate-300">—</span>}
                {stats.averageSleep !== null && (
                  <span className="text-base font-normal text-slate-400">h</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Days at 2 or below
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{stats.lowDays}</p>
            </div>
          </div>

          {/* One row, chronological, each mark carrying its own number — the
              colour is a second encoding, never the only one. */}
          <div className="mt-5 overflow-x-auto">
            <div className="flex gap-1">
              {entries.map((entry) => (
                <div key={entry.day} className="flex flex-col items-center gap-1">
                  <MoodDot mood={entry.mood} size="sm" />
                  <span className="text-[9px] whitespace-nowrap text-slate-400">
                    {shortDay(entry.day).split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card
        title="Read it back to me"
        description="Reads the numbers you logged. Your written notes are never included."
      >
        <Button onClick={() => void readBack()} loading={reading} disabled={entries.length === 0}>
          {checkin ? 'Read again' : 'Read my log'}
        </Button>

        {entries.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">Log a few days first.</p>
        )}

        {checkin && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-800">{checkin.observation}</p>
            <p className="text-sm text-slate-700">{checkin.pattern}</p>

            <ul className="space-y-2">
              {checkin.suggestions.map((suggestion) => (
                <li key={suggestion.title} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{suggestion.title}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                      {suggestion.effort}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{suggestion.why}</p>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Talking to someone
              </p>
              <p className="mt-1 text-sm text-slate-700">{checkin.reachOut}</p>
            </div>

            <p className="text-sm text-slate-600 italic">{checkin.note}</p>
          </div>
        )}
      </Card>

      <Card title="Every entry">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : newest.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing logged in this range.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {newest.map((entry) => (
              <li key={entry.day} className="flex items-start gap-3 py-3">
                <MoodDot mood={entry.mood} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {shortDay(entry.day)}
                    </span>
                    <span className="text-sm text-slate-500">{MOOD_LABEL[entry.mood]}</span>
                    {entry.sleepHours !== null && (
                      <span className="text-xs text-slate-500">slept {entry.sleepHours}h</span>
                    )}
                    {entry.energy !== null && (
                      <span className="text-xs text-slate-500">energy {entry.energy}/5</span>
                    )}
                    <button
                      onClick={() => void remove(entry.day)}
                      className="ml-auto text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>

                  {entry.factors.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.factors.map((factor) => (
                        <span
                          key={factor}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {FACTOR_LABEL[factor]}
                        </span>
                      ))}
                    </div>
                  )}

                  {entry.note && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">{entry.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
