import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui'
import {
  FACTOR_LABEL,
  FocusBars,
  MOOD_LABEL,
  MoodDot,
  SupportNote,
  WEEKDAY_INITIAL,
} from './shared'
import type { Habit, MoodFactor, WellbeingOverview } from '../../types'

const FACTORS: MoodFactor[] = [
  'sleep',
  'workload',
  'exams',
  'health',
  'social',
  'family',
  'money',
  'other',
]

export function WellbeingHome() {
  const [overview, setOverview] = useState<WellbeingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [mood, setMood] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [sleepHours, setSleepHours] = useState('')
  const [factors, setFactors] = useState<MoodFactor[]>([])
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/wellbeing/overview')
      setOverview(data.data)
      if (data.data.mood) {
        setMood(data.data.mood.mood)
        setEnergy(data.data.mood.energy ?? 0)
        setSleepHours(data.data.mood.sleepHours?.toString() ?? '')
        setFactors(data.data.mood.factors)
        setNote(data.data.mood.note)
      }
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveMood = async (e: FormEvent) => {
    e.preventDefault()
    if (mood < 1) {
      setError('Pick how today has been.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await api.post('/wellbeing/mood', {
        mood,
        energy: energy || null,
        sleepHours: sleepHours === '' ? null : Number(sleepHours),
        factors,
        note,
      })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const tickHabit = async (habit: Habit, done: boolean) => {
    try {
      const { data } = await api.post(`/wellbeing/habits/${habit.id}/log`, { done })
      setOverview((prev) =>
        prev
          ? { ...prev, habits: prev.habits.map((h) => (h.id === habit.id ? data.data.habit : h)) }
          : prev,
      )
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const tickChallenge = async (key: string, done: boolean) => {
    try {
      await api.post(`/wellbeing/challenges/${key}/checkin`, { done })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  const toggleFactor = (factor: MoodFactor) =>
    setFactors((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor],
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wellbeing</h1>
          <p className="mt-1 text-sm text-slate-600">
            Private to you — none of this is shared, ranked, or shown to anyone else.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/wellbeing/mood"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Mood history
          </Link>
          <Link
            to="/wellbeing/focus"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Focus timer
          </Link>
          <Link
            to="/wellbeing/challenges"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Challenges
          </Link>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {overview && <SupportNote support={overview.support} />}

      <Card
        title="How has today been?"
        description={overview?.mood ? 'Logged today — changing it updates the entry.' : undefined}
      >
        <form onSubmit={saveMood} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMood(value)}
                aria-pressed={mood === value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  mood === value
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MoodDot mood={value} size="sm" />
                {MOOD_LABEL[value]}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Energy" hint="Optional — 1 is flat, 5 is buzzing.">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEnergy(energy === value ? 0 : value)}
                    aria-pressed={energy === value}
                    className={`h-9 w-9 rounded-lg border text-sm font-medium tabular-nums transition ${
                      energy === value
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Sleep last night" hint="Optional, in hours.">
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="7"
              />
            </Field>
          </div>

          <Field label="What was going on?" hint="Optional. Pick any that apply.">
            <div className="flex flex-wrap gap-1.5">
              {FACTORS.map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => toggleFactor(factor)}
                  aria-pressed={factors.includes(factor)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    factors.includes(factor)
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {FACTOR_LABEL[factor]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Note" hint="Just for you. This is never sent anywhere or used by the AI.">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <Button type="submit" loading={saving}>
            {overview?.mood ? 'Update today' : 'Save today'}
          </Button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Habits"
          description={overview?.habits.length ? 'Tick what you did today.' : undefined}
          actions={
            <Link
              to="/wellbeing/habits"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Manage →
            </Link>
          }
        >
          {overview?.habits.length === 0 ? (
            <p className="text-sm text-slate-500">
              No habits yet. One or two small ones beat a list of ten.
            </p>
          ) : (
            <ul className="space-y-3">
              {overview?.habits.map((habit) => (
                <li key={habit.id}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={habit.doneToday}
                      disabled={!habit.appliesToday}
                      onChange={(e) => void tickHabit(habit, e.target.checked)}
                      aria-label={`${habit.title} done today`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                    />
                    <span
                      className={`min-w-0 flex-1 text-sm font-medium ${
                        habit.appliesToday ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {habit.title}
                      {!habit.appliesToday && (
                        <span className="ml-1 text-xs font-normal">· not today</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {habit.streak.current} day{habit.streak.current === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="mt-1.5 flex gap-1 pl-7">
                    {habit.lastWeek.map((day) => (
                      <span
                        key={day.day}
                        title={`${day.day}${day.applies ? (day.done ? ': done' : ': missed') : ': not scheduled'}`}
                        className={`grid h-5 w-5 place-items-center rounded text-[10px] font-medium ${
                          !day.applies
                            ? 'bg-slate-50 text-slate-300'
                            : day.done
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {WEEKDAY_INITIAL[new Date(`${day.day}T00:00:00`).getDay()]}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Focus this week"
          description={`${overview?.focus.weekMinutes ?? 0} minutes across seven days.`}
          actions={
            <Link
              to="/wellbeing/focus"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Start →
            </Link>
          }
        >
          {overview && <FocusBars data={overview.focus.byDay} />}
          <p className="mt-3 text-sm text-slate-600">
            {overview?.focus.todayMinutes
              ? `${overview.focus.todayMinutes} minutes today across ${overview.focus.todaySessions} session${overview.focus.todaySessions === 1 ? '' : 's'}.`
              : 'Nothing logged today yet.'}
          </p>
        </Card>
      </div>

      {overview && overview.challenges.length > 0 && (
        <Card title="Challenges you're doing">
          <ul className="space-y-3">
            {overview.challenges.map((enrollment) => (
              <li key={enrollment.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {enrollment.challenge?.title ?? 'A challenge'}
                  </span>
                  <span className="ml-auto text-xs text-slate-500 tabular-nums">
                    {enrollment.daysDone}/{enrollment.daysTotal} days
                  </span>
                </div>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enrollment.doneToday}
                    onChange={(e) =>
                      enrollment.challenge &&
                      void tickChallenge(enrollment.challenge.key, e.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700">{enrollment.challenge?.dailyPrompt}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {overview && (
        <Card title="Tip of the day">
          <h3 className="font-medium text-slate-900">{overview.tipOfTheDay.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{overview.tipOfTheDay.body}</p>
        </Card>
      )}
    </div>
  )
}
