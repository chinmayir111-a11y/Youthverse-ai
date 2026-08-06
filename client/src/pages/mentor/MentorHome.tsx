import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import { CategoryBadge, MODULE_PATH, ProgressBar, Stat } from './shared'
import type { DailyBrief, MentorOverview } from '../../types'

export function MentorHome() {
  const [overview, setOverview] = useState<MentorOverview | null>(null)
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/mentor/overview')
      setOverview(data.data)
      setBrief(data.data.brief)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const generate = async (regenerate: boolean) => {
    setError('')
    setGenerating(true)
    try {
      const { data } = await api.post('/mentor/brief', { regenerate })
      setBrief(data.data.brief)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setGenerating(false)
    }
  }

  const toggleAction = async (index: number, done: boolean) => {
    try {
      const { data } = await api.patch('/mentor/brief/actions', { index, done })
      setBrief(data.data.brief)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  const a = overview?.analytics
  const done = new Set(brief?.completedActions ?? [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Mentor</h1>
          <p className="mt-1 text-sm text-slate-600">
            What to do today, what you're aiming at, and what the numbers actually say.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/mentor/goals"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Goals
          </Link>
          <Link
            to="/mentor/plans"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Study plans
          </Link>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card
        title="Today"
        description={brief ? `Written for ${brief.day}.` : 'One brief a day, so the plan holds still.'}
        actions={
          brief && (
            <Button variant="secondary" loading={generating} onClick={() => void generate(true)}>
              Rewrite
            </Button>
          )
        }
      >
        {!brief ? (
          <div>
            <p className="text-sm text-slate-600">
              Nothing written for today yet. The brief reads your goals and what you've actually
              done in the app, so it's worth filling in a goal first if you haven't.
            </p>
            <div className="mt-3">
              <Button loading={generating} onClick={() => void generate(false)}>
                Write today's brief
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-slate-900">{brief.payload.headline}</p>
              <p className="mt-1 text-sm text-slate-700">{brief.payload.focus}</p>
            </div>

            <ul className="space-y-2">
              {brief.payload.actions.map((action, index) => {
                const isDone = done.has(index)
                const href = MODULE_PATH[action.module]
                return (
                  <li
                    key={`${action.title}-${index}`}
                    className={`rounded-lg border p-3 transition ${
                      isDone ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={(e) => void toggleAction(index, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-medium ${
                            isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {action.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600">{action.why}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{action.minutes} min</span>
                          {href && (
                            <Link to={href} className="font-medium text-brand-600 hover:underline">
                              Go to {action.module} →
                            </Link>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
                  Watch out
                </p>
                <p className="mt-1 text-sm text-amber-900">{brief.payload.watchOut}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Career advice
                </p>
                <p className="mt-1 text-sm text-slate-700">{brief.payload.careerAdvice}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 italic">{brief.payload.encouragement}</p>
          </div>
        )}
      </Card>

      <Card
        title="Goals"
        description={
          overview?.goals.length
            ? `${a?.goals.active ?? 0} active${a?.goals.overdue ? `, ${a.goals.overdue} overdue` : ''}.`
            : 'Nothing tracked yet.'
        }
        actions={
          <Link to="/mentor/goals" className="text-sm font-medium text-brand-600 hover:underline">
            Manage →
          </Link>
        }
      >
        {overview?.goals.length === 0 ? (
          <p className="text-sm text-slate-500">
            Set one goal with a date on it. Everything else here gets sharper once there is
            something to aim at.
          </p>
        ) : (
          <ul className="space-y-3">
            {overview?.goals.map((goal) => (
              <li key={goal.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge category={goal.category} />
                  <span className="text-sm font-medium text-slate-900">{goal.title}</span>
                  <span className="ml-auto text-xs text-slate-500 tabular-nums">
                    {goal.progress}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={goal.progress} />
                </div>
                {goal.daysLeft !== null && (
                  <p
                    className={`mt-1 text-xs ${
                      goal.overdue
                        ? 'font-medium text-red-600'
                        : goal.daysLeft <= 7
                          ? 'text-amber-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {goal.overdue
                      ? `${Math.abs(goal.daysLeft)} days overdue`
                      : `${goal.daysLeft} days left`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {a && (
        <Card
          title="Learning analytics"
          description="Counted from what you've actually done — nothing here is estimated."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Documents" value={a.study.documents} hint={`${a.study.documentsThisWeek} this week`} />
            <Stat label="Quizzes made" value={a.study.quizzes} hint={`${a.study.flashcardDecks} card decks`} />
            <Stat
              label="Interviews graded"
              value={a.career.interviews.graded}
              hint={`${a.career.interviews.total} started`}
            />
            <Stat
              label="Avg interview score"
              value={a.career.averageInterviewScore}
              hint={
                a.career.bestInterviewScore !== null
                  ? `best ${a.career.bestInterviewScore}/100`
                  : 'nothing graded yet'
              }
            />
            <Stat
              label="Applications"
              value={a.career.applications.total}
              hint={`${a.career.applications.byStage.interview} at interview`}
            />
            <Stat
              label="Projects"
              value={a.building.projectsOwned + a.building.projectsJoined}
              hint={`${a.building.projectsOwned} yours`}
            />
            <Stat
              label="Resources shared"
              value={a.building.resourcesShared}
              hint={`${a.building.resourceDownloads} downloads`}
            />
            <Stat
              label="Goals achieved"
              value={a.goals.achieved}
              hint={a.goals.averageProgress !== null ? `${a.goals.averageProgress}% avg progress` : 'none active'}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Quiz <em>scores</em> aren't here because attempts aren't recorded yet — only the decks
            you generated are counted.
          </p>
        </Card>
      )}
    </div>
  )
}
