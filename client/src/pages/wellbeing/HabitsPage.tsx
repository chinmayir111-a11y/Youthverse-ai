import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input } from '../../components/ui'
import { WEEKDAY_INITIAL } from './shared'
import type { Habit } from '../../types'

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

export function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [title, setTitle] = useState('')
  const [days, setDays] = useState<number[]>(ALL_DAYS)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/wellbeing/habits', {
        params: showArchived ? { includeArchived: 'true' } : {},
      })
      setHabits(data.data.habits)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api.post('/wellbeing/habits', { title, daysOfWeek: days })
      setTitle('')
      setDays(ALL_DAYS)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setCreating(false)
    }
  }

  const tick = async (habit: Habit, day: string, done: boolean) => {
    try {
      const { data } = await api.post(`/wellbeing/habits/${habit.id}/log`, { day, done })
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? data.data.habit : h)))
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const setArchived = async (habit: Habit, archived: boolean) => {
    try {
      await api.patch(`/wellbeing/habits/${habit.id}`, { archived })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const remove = async (habit: Habit) => {
    if (!window.confirm(`Delete "${habit.title}"? Its history goes too.`)) return
    try {
      await api.delete(`/wellbeing/habits/${habit.id}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const toggleDay = (day: number) =>
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    )

  return (
    <div className="space-y-6">
      <div>
        <Link to="/wellbeing" className="text-sm font-medium text-brand-600 hover:underline">
          ← Wellbeing
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Habits</h1>
        <p className="mt-1 text-sm text-slate-600">
          A habit only counts on the days you set it for — a weekday habit isn't broken by a
          Saturday.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="New habit">
        <form onSubmit={create} className="space-y-4" noValidate>
          <Field label="Habit">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Read for 20 minutes"
              required
            />
          </Field>

          <Field label="Which days?">
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={days.includes(day)}
                  aria-label={`Day ${day}`}
                  className={`h-9 w-9 rounded-lg border text-sm font-medium transition ${
                    days.includes(day)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {WEEKDAY_INITIAL[day]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDays(ALL_DAYS)}
                className="ml-2 text-xs font-medium text-brand-600 hover:underline"
              >
                Every day
              </button>
              <button
                type="button"
                onClick={() => setDays(WEEKDAYS)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Weekdays
              </button>
            </div>
          </Field>

          <Button type="submit" loading={creating}>
            Add habit
          </Button>
        </form>
      </Card>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        Show archived
      </label>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-slate-500">No habits yet.</p>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <Card key={habit.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={`font-semibold ${habit.archived ? 'text-slate-400' : 'text-slate-900'}`}>
                  {habit.title}
                </h2>
                {habit.archived && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    archived
                  </span>
                )}
                <span className="ml-auto text-sm text-slate-600 tabular-nums">
                  {habit.streak.current} day streak
                  <span className="ml-2 text-xs text-slate-400">
                    best {habit.streak.longest}
                  </span>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {habit.lastWeek.map((day) => (
                  <button
                    key={day.day}
                    disabled={!day.applies || habit.archived}
                    onClick={() => void tick(habit, day.day, !day.done)}
                    title={`${day.day}${day.applies ? '' : ' — not scheduled'}`}
                    aria-pressed={day.done}
                    className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-medium transition ${
                      !day.applies
                        ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                        : day.done
                          ? 'bg-brand-600 text-white hover:bg-brand-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {WEEKDAY_INITIAL[new Date(`${day.day}T00:00:00`).getDay()]}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void setArchived(habit, !habit.archived)}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  {habit.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  onClick={() => void remove(habit)}
                  className="ml-auto text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
