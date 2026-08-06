import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import { CATEGORY_LABEL, CategoryBadge, ProgressBar, STATUS_LABEL } from './shared'
import type { Goal, GoalCategory, GoalStatus } from '../../types'

const CATEGORIES: GoalCategory[] = ['study', 'career', 'project', 'skill', 'other']
const STATUSES: GoalStatus[] = ['active', 'achieved', 'paused', 'dropped']

const blank = {
  title: '',
  detail: '',
  category: 'study' as GoalCategory,
  targetDate: '',
  steps: '',
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [filter, setFilter] = useState<GoalStatus | ''>('active')
  const [form, setForm] = useState(blank)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/mentor/goals', {
        params: filter ? { status: filter } : {},
      })
      setGoals(data.data.goals)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api.post('/mentor/goals', {
        title: form.title,
        detail: form.detail,
        category: form.category,
        targetDate: form.targetDate || null,
        steps: form.steps
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((title) => ({ title, done: false })),
      })
      setForm(blank)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setCreating(false)
    }
  }

  const patch = async (goal: Goal, updates: Record<string, unknown>) => {
    setError('')
    try {
      const { data } = await api.patch(`/mentor/goals/${goal.id}`, updates)
      const updated: Goal = data.data.goal
      // A goal can drop out of the current filter by being updated, so re-read
      // rather than patching it in place.
      if (filter && updated.status !== filter) await load()
      else setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)))
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const toggleStep = (goal: Goal, index: number, done: boolean) =>
    patch(goal, {
      steps: goal.steps.map((s, i) => (i === index ? { ...s, done } : s)),
    })

  const remove = async (goal: Goal) => {
    if (!window.confirm(`Delete "${goal.title}"?`)) return
    try {
      await api.delete(`/mentor/goals/${goal.id}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/mentor" className="text-sm font-medium text-brand-600 hover:underline">
            ← AI Mentor
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Goals</h1>
          <p className="mt-1 text-sm text-slate-600">
            A goal with a date and a few steps beats a long list of intentions.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'New goal'}</Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-4" noValidate>
            <Field label="Goal">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Clear the DBMS backlog before end-sems"
                required
              />
            </Field>

            <Field label="Detail" hint="What finishing it actually looks like.">
              <Textarea
                rows={2}
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as GoalCategory })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Target date" hint="Leave blank if there's no deadline.">
                <Input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Steps"
              hint="One per line. If you add steps, progress is counted from them rather than set by hand."
            >
              <Textarea
                rows={4}
                value={form.steps}
                onChange={(e) => setForm({ ...form, steps: e.target.value })}
                placeholder={'Finish normalisation notes\nDo 3 past papers\nRedo the weakest topic'}
              />
            </Field>

            <Button type="submit" loading={creating}>
              Add goal
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['active', 'achieved', 'paused', 'dropped', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === s
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s ? STATUS_LABEL[s] : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filter === 'active'
            ? 'No active goals. Add one — the daily brief works off these.'
            : 'Nothing here.'}
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={goal.category} />
                <h2 className="font-semibold text-slate-900">{goal.title}</h2>
                <span className="ml-auto text-sm font-medium text-slate-700 tabular-nums">
                  {goal.progress}%
                </span>
              </div>

              {goal.detail && <p className="mt-1 text-sm text-slate-600">{goal.detail}</p>}

              <div className="mt-2">
                <ProgressBar value={goal.progress} tone={goal.status === 'active' ? 'brand' : 'slate'} />
              </div>

              {goal.targetDate && (
                <p
                  className={`mt-1.5 text-xs ${
                    goal.overdue ? 'font-medium text-red-600' : 'text-slate-500'
                  }`}
                >
                  {goal.overdue
                    ? `Overdue by ${Math.abs(goal.daysLeft ?? 0)} days`
                    : `Due ${new Date(goal.targetDate).toLocaleDateString()}`}
                </p>
              )}

              {goal.steps.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {goal.steps.map((step, index) => (
                    <li key={`${step.title}-${index}`}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step.done}
                          onChange={(e) => void toggleStep(goal, index, e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className={step.done ? 'text-slate-400 line-through' : 'text-slate-700'}>
                          {step.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {!goal.tracksSteps && goal.status === 'active' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Progress: {goal.manualProgress}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={goal.manualProgress}
                      onChange={(e) => void patch(goal, { manualProgress: Number(e.target.value) })}
                      className="mt-1 w-full accent-brand-600"
                    />
                  </label>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value={goal.status}
                  onChange={(e) => void patch(goal, { status: e.target.value })}
                  className="w-auto"
                  aria-label={`Status for ${goal.title}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
                <button
                  onClick={() => void remove(goal)}
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
