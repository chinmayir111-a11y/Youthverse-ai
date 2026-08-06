import { useState, type FormEvent } from 'react'
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui'
import { Block, Bullets, Chip, HistoryStrip, ScoreBar, useArtifacts } from './shared'
import type { AtsPayload } from '../../types'

export function AtsPanel() {
  const { history, current, setCurrent, loading, busy, error, generate, remove } =
    useArtifacts<AtsPayload>('ats', '/career/resume/ats')

  const [targetRole, setTargetRole] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void generate({ targetRole, jobDescription })
  }

  const report = current?.payload

  return (
    <div className="space-y-5">
      <Card
        title="Check your resume against a job"
        description="Paste the posting. Without one, the resume is reviewed on its own merits and keyword lists stay empty."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Target role">
            <Input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Backend Engineer"
            />
          </Field>
          <Field label="Job description">
            <Textarea
              rows={6}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the requirements section…"
            />
          </Field>
          <Button type="submit" loading={busy}>
            {report ? 'Run check again' : 'Run ATS check'}
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

      {loading && <p className="text-sm text-slate-500">Loading previous checks…</p>}

      {!loading && !report && !busy && (
        <p className="text-sm text-slate-500">
          No checks run yet. Paste a job description above to get a score.
        </p>
      )}

      {report && (
        <Card title={current?.title} description={new Date(current!.createdAt).toLocaleString()}>
          <div className="space-y-6">
            <div>
              <ScoreBar value={report.score} label="ATS match score" />
              <p className="mt-2 text-sm text-slate-700">{report.verdict}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Block title="Matched keywords">
                {report.matchedKeywords.length === 0 ? (
                  <p className="text-sm text-slate-500">None — or no job description was given.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {report.matchedKeywords.map((k) => (
                      <Chip key={k} tone="good">
                        {k}
                      </Chip>
                    ))}
                  </div>
                )}
              </Block>

              <Block title="Missing keywords">
                {report.missingKeywords.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing obvious is missing.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {report.missingKeywords.map((k) => (
                      <Chip key={k} tone="bad">
                        {k}
                      </Chip>
                    ))}
                  </div>
                )}
              </Block>
            </div>

            <Block title="Section feedback">
              <ul className="space-y-3">
                {report.sectionFeedback.map((s, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{s.section}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{s.issue}</p>
                    <p className="mt-1.5 text-sm text-slate-800">
                      <span className="font-medium text-emerald-700">Fix: </span>
                      {s.fix}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>

            {report.rewrites.length > 0 && (
              <Block title="Line rewrites">
                <ul className="space-y-3">
                  {report.rewrites.map((r, i) => (
                    <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="text-slate-500 line-through">{r.original}</p>
                      <p className="mt-1 text-slate-900">{r.improved}</p>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Block title="What already works">
                <Bullets items={report.strengths} />
              </Block>
              <Block title="Formatting issues">
                <Bullets items={report.formattingIssues} />
              </Block>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
