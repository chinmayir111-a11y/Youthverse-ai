import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import type { Challenge, ChallengeEnrollment } from '../../types'

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [active, setActive] = useState<ChallengeEnrollment[]>([])
  const [history, setHistory] = useState<ChallengeEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/wellbeing/challenges')
      setChallenges(data.data.challenges)
      setActive(data.data.active)
      setHistory(data.data.history)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (key: string, action: 'join' | 'leave') => {
    setError('')
    try {
      await api.post(`/wellbeing/challenges/${key}/${action}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const checkin = async (key: string, done: boolean) => {
    try {
      await api.post(`/wellbeing/challenges/${key}/checkin`, { done })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const activeFor = (key: string) => active.find((e) => e.challenge?.key === key) ?? null

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div className="space-y-6">
      <div>
        <Link to="/wellbeing" className="text-sm font-medium text-brand-600 hover:underline">
          ← Wellbeing
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Digital wellness challenges</h1>
        <p className="mt-1 text-sm text-slate-600">
          Short experiments, not rules. Missing a day doesn't reset anything — the days just add
          up until you reach the total.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {challenges.map((challenge) => {
          const enrollment = activeFor(challenge.key)

          return (
            <Card key={challenge.key}>
              <div className="flex flex-wrap items-start gap-2">
                <h2 className="font-semibold text-slate-900">{challenge.title}</h2>
                <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {challenge.days} days
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-700">{challenge.summary}</p>
              <p className="mt-2 text-sm text-slate-600">{challenge.why}</p>

              {enrollment ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{
                          width: `${Math.min(100, (enrollment.daysDone / enrollment.daysTotal) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {enrollment.daysDone}/{enrollment.daysTotal}
                    </span>
                  </div>

                  <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={enrollment.doneToday}
                      onChange={(e) => void checkin(challenge.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-slate-700">{challenge.dailyPrompt}</span>
                  </label>

                  <button
                    onClick={() => void act(challenge.key, 'leave')}
                    className="text-xs font-medium text-slate-500 hover:underline"
                  >
                    Stop this challenge
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <Button variant="secondary" onClick={() => void act(challenge.key, 'join')}>
                    Start it
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {history.length > 0 && (
        <Card title="Previously">
          <ul className="divide-y divide-slate-100">
            {history.map((enrollment) => (
              <li key={enrollment.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="text-slate-700">{enrollment.challenge?.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    enrollment.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {enrollment.status}
                </span>
                <span className="ml-auto text-xs text-slate-500 tabular-nums">
                  {enrollment.daysDone}/{enrollment.daysTotal} days
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
