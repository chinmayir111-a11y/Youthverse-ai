import { useState, type FormEvent } from 'react'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui'
import { HistoryStrip, ScoreBar, useArtifacts } from './shared'
import type { CareerArtifact, RoadmapPayload } from '../../types'

/**
 * Milestone keys are positional — "<phaseIndex>.<milestoneIndex>" — and assigned
 * the same way on the server. Model-generated ids aren't stable enough to store
 * progress against, so position is the contract between the two.
 */
const keyFor = (phaseIndex: number, milestoneIndex: number) => `${phaseIndex}.${milestoneIndex}`

export function RoadmapPage() {
  const { history, current, setCurrent, loading, busy, error, setError, generate, remove } =
    useArtifacts<RoadmapPayload>('roadmap', '/career/roadmap')

  const [goal, setGoal] = useState('')
  const [weeks, setWeeks] = useState('12')
  const [hoursPerWeek, setHoursPerWeek] = useState('8')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!goal.trim()) return
    void generate({ goal: goal.trim(), weeks: Number(weeks), hoursPerWeek: Number(hoursPerWeek) })
  }

  const toggle = async (milestoneId: string, done: boolean) => {
    if (!current) return
    setSavingKey(milestoneId)
    try {
      const { data } = await api.patch(`/career/artifacts/${current.id}/milestones`, {
        milestoneId,
        done,
      })
      const updated: CareerArtifact<RoadmapPayload> = data.data.artifact
      setCurrent(updated)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSavingKey(null)
    }
  }

  const roadmap = current?.payload
  const total = roadmap?.phases.reduce((sum, p) => sum + p.milestones.length, 0) ?? 0
  const done = current?.completedMilestones.length ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roadmap Generator</h1>
        <p className="mt-1 text-sm text-slate-600">
          A plan sized to the time you actually have. Tick milestones off as you finish them.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Field label="Goal">
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Land a backend internship"
              />
            </Field>
          </div>
          <Field label="Weeks">
            <Select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
              {[4, 8, 12, 16, 24, 36, 52].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hours / week">
            <Select value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)}>
              {[4, 6, 8, 12, 20, 30].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={busy} disabled={!goal.trim()}>
            Generate roadmap
          </Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <HistoryStrip
        history={history}
        current={current}
        onSelect={setCurrent}
        onDelete={(id) => void remove(id)}
      />

      {loading && <p className="text-sm text-slate-500">Loading previous roadmaps…</p>}

      {!loading && !roadmap && !busy && (
        <p className="text-sm text-slate-500">
          No roadmap yet. Describe where you want to get to and how long you have.
        </p>
      )}

      {roadmap && current && (
        <Card title={roadmap.title} description={roadmap.summary}>
          <div className="space-y-6">
            <ScoreBar
              value={total ? (done / total) * 100 : 0}
              label={`Progress — ${done} of ${total} milestones`}
            />

            {roadmap.phases.map((phase, phaseIndex) => (
              <section key={phaseIndex} className="rounded-lg border border-slate-200">
                <header className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <h3 className="font-semibold text-slate-900">
                    {phase.name}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {phase.durationWeeks} week{phase.durationWeeks === 1 ? '' : 's'}
                    </span>
                  </h3>
                  <p className="text-sm text-slate-600">{phase.focus}</p>
                </header>

                <ul className="divide-y divide-slate-100">
                  {phase.milestones.map((milestone, milestoneIndex) => {
                    const id = keyFor(phaseIndex, milestoneIndex)
                    const checked = current.completedMilestones.includes(id)
                    return (
                      <li key={id} className="flex gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={savingKey === id}
                          onChange={(e) => void toggle(id, e.target.checked)}
                          aria-label={milestone.title}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="min-w-0">
                          <p
                            className={`font-medium ${
                              checked ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          >
                            {milestone.title}
                          </p>
                          <p className="text-sm text-slate-600">{milestone.detail}</p>
                          {milestone.resource && (
                            <p className="mt-0.5 text-xs text-slate-500">→ {milestone.resource}</p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
