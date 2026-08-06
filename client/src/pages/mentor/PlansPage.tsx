import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui'
import { ProgressBar } from './shared'
import type { Goal, StudyPlan } from '../../types'

export function PlansPage() {
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [topic, setTopic] = useState('')
  const [weeks, setWeeks] = useState(4)
  const [hoursPerWeek, setHoursPerWeek] = useState(6)
  const [goalId, setGoalId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [{ data: p }, { data: g }] = await Promise.all([
        api.get('/mentor/plans'),
        api.get('/mentor/goals', { params: { status: 'active' } }),
      ])
      setPlans(p.data.plans)
      setGoals(g.data.goals)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setGenerating(true)
    try {
      await api.post('/mentor/plans', {
        topic,
        weeks,
        hoursPerWeek,
        goalId: goalId || undefined,
      })
      setTopic('')
      setGoalId('')
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setGenerating(false)
    }
  }

  const remove = async (plan: StudyPlan) => {
    if (!window.confirm(`Delete "${plan.title}"?`)) return
    try {
      await api.delete(`/mentor/plans/${plan.id}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/mentor" className="text-sm font-medium text-brand-600 hover:underline">
          ← AI Mentor
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Study plans</h1>
        <p className="mt-1 text-sm text-slate-600">
          A week-by-week plan sized to the hours you actually have. For the longer "how do I become
          X" version, use the roadmap in the{' '}
          <Link to="/career/roadmap" className="font-medium text-brand-600 hover:underline">
            Career Hub
          </Link>
          .
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="New plan">
        <form onSubmit={generate} className="space-y-4" noValidate>
          <Field label="What's it for?">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Operating systems end-sem"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Weeks">
              <Input
                type="number"
                min={1}
                max={12}
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
              />
            </Field>
            <Field label="Hours per week" hint="Be honest, not aspirational.">
              <Input
                type="number"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              />
            </Field>
            <Field label="Attach to goal" hint="Optional.">
              <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">No goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button type="submit" loading={generating}>
            Generate plan
          </Button>
        </form>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-slate-500">No plans yet.</p>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/mentor/plans/${plan.id}`}
                  className="font-semibold text-slate-900 hover:text-brand-700"
                >
                  {plan.title}
                </Link>
                <span className="ml-auto text-sm font-medium text-slate-700 tabular-nums">
                  {plan.progress}%
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-600">{plan.payload.summary}</p>

              <div className="mt-2">
                <ProgressBar value={plan.progress} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  {plan.payload.weeks.length} weeks · {plan.taskCount} tasks
                </span>
                {plan.input.hoursPerWeek && <span>{plan.input.hoursPerWeek} h/week</span>}
                <button
                  onClick={() => void remove(plan)}
                  className="ml-auto font-medium text-red-600 hover:underline"
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
