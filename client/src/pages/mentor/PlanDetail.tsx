import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Card } from '../../components/ui'
import { ProgressBar } from './shared'
import type { StudyPlan } from '../../types'

export function PlanDetail() {
  const { planId = '' } = useParams()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/mentor/plans/${planId}`)
      setPlan(data.data.plan)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }, [planId])

  useEffect(() => {
    void load()
  }, [load])

  // Keys are "<weekIndex>.<taskIndex>" and are assigned server-side — the
  // client only ever echoes back a key the server would recognise.
  const toggle = async (key: string, done: boolean) => {
    setError('')
    try {
      const { data } = await api.patch(`/mentor/plans/${planId}/items`, { key, done })
      setPlan(data.data.plan)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  if (error && !plan) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link to="/mentor/plans" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to plans
        </Link>
      </div>
    )
  }

  if (!plan) return <p className="text-sm text-slate-500">Loading…</p>

  const done = new Set(plan.completedItems)

  return (
    <div className="space-y-5">
      <div>
        <Link to="/mentor/plans" className="text-sm font-medium text-brand-600 hover:underline">
          ← All plans
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{plan.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{plan.payload.summary}</p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar value={plan.progress} />
          </div>
          <span className="text-sm font-medium text-slate-700 tabular-nums">
            {done.size}/{plan.taskCount}
          </span>
        </div>
      </Card>

      {plan.payload.weeks.map((week, weekIndex) => {
        const weekKeys = week.tasks.map((_, taskIndex) => `${weekIndex}.${taskIndex}`)
        const weekDone = weekKeys.filter((k) => done.has(k)).length

        return (
          <Card
            key={weekIndex}
            title={`Week ${weekIndex + 1}`}
            description={week.focus}
            actions={
              <span className="text-xs text-slate-500 tabular-nums">
                {weekDone}/{week.tasks.length}
              </span>
            }
          >
            <ul className="space-y-2">
              {week.tasks.map((task, taskIndex) => {
                const key = `${weekIndex}.${taskIndex}`
                const isDone = done.has(key)
                return (
                  <li key={key} className="rounded-lg border border-slate-200 p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={(e) => void toggle(key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-medium ${
                            isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600">{task.detail}</span>
                        <span className="mt-1 block text-xs text-slate-500">~{task.hours} hours</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Checkpoint
              </p>
              <p className="mt-1 text-sm text-slate-700">{week.checkpoint}</p>
            </div>
          </Card>
        )
      })}

      <Card title="If you fall behind">
        <p className="text-sm text-slate-700">{plan.payload.ifBehind}</p>
      </Card>
    </div>
  )
}
