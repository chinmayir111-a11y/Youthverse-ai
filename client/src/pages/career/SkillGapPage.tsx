import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Field, Input } from '../../components/ui'
import { Block, Bullets, Chip, HistoryStrip, ScoreBar, useArtifacts } from './shared'
import type { SkillGapPayload } from '../../types'

const TONE = {
  critical: 'bad',
  important: 'warn',
  'nice-to-have': 'neutral',
} as const

export function SkillGapPage() {
  const { history, current, setCurrent, loading, busy, error, generate, remove } =
    useArtifacts<SkillGapPayload>('skill_gap', '/career/skill-gap')
  const [targetRole, setTargetRole] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!targetRole.trim()) return
    void generate({ targetRole: targetRole.trim() })
  }

  const report = current?.payload

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Skill Gap Analysis</h1>
        <p className="mt-1 text-sm text-slate-600">
          Compares the skills on{' '}
          <Link to="/profile" className="font-medium text-brand-600 hover:underline">
            your profile
          </Link>{' '}
          against what a role actually hires for.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Field label="Target role">
              <Input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Backend Engineer"
              />
            </Field>
          </div>
          <Button type="submit" loading={busy} disabled={!targetRole.trim()}>
            Analyse gaps
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

      {loading && <p className="text-sm text-slate-500">Loading previous analyses…</p>}

      {!loading && !report && !busy && (
        <p className="text-sm text-slate-500">
          No analysis yet. Name a role above — the more complete your profile, the better this gets.
        </p>
      )}

      {report && (
        <Card title={report.targetRole} description={new Date(current!.createdAt).toLocaleString()}>
          <div className="space-y-6">
            <div>
              <ScoreBar value={report.readiness} label="Readiness for this role" />
              <p className="mt-2 text-sm text-slate-700">{report.summary}</p>
            </div>

            <Block title="What you already have">
              <Bullets items={report.strengths} />
            </Block>

            <Block title="Gaps">
              <ul className="space-y-3">
                {report.gaps.map((gap, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{gap.skill}</span>
                      <Chip tone={TONE[gap.importance] ?? 'neutral'}>{gap.importance}</Chip>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{gap.whyItMatters}</p>
                    <p className="mt-1.5 text-sm text-slate-800">
                      <span className="font-medium text-brand-700">Start with: </span>
                      {gap.howToClose}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title="Do these first">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {report.nextSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </Block>

            <p className="text-sm text-slate-500">
              Want this as a schedule?{' '}
              <Link to="/career/roadmap" className="font-medium text-brand-600 hover:underline">
                Generate a roadmap
              </Link>
              .
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
