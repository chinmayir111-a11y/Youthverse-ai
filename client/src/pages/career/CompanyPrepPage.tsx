import { useState, type FormEvent } from 'react'
import { Alert, Button, Card, Field, Input } from '../../components/ui'
import { Block, Bullets, Chip, HistoryStrip, useArtifacts } from './shared'
import type { CompanyPrepPayload } from '../../types'

export function CompanyPrepPage() {
  const { history, current, setCurrent, loading, busy, error, generate, remove } =
    useArtifacts<CompanyPrepPayload>('company_prep', '/career/company-prep')

  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!company.trim() || !role.trim()) return
    void generate({ company: company.trim(), role: role.trim() })
  }

  const brief = current?.payload

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Preparation</h1>
        <p className="mt-1 text-sm text-slate-600">
          The general shape of how a company hires for a role — what to expect and what to study.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Field label="Company">
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Zoho"
              />
            </Field>
          </div>
          <div className="min-w-[12rem] flex-1">
            <Field label="Role">
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer"
              />
            </Field>
          </div>
          <Button type="submit" loading={busy} disabled={!company.trim() || !role.trim()}>
            Build brief
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

      {loading && <p className="text-sm text-slate-500">Loading previous briefs…</p>}

      {!loading && !brief && !busy && (
        <p className="text-sm text-slate-500">
          No briefs yet. Name a company and role to build one.
        </p>
      )}

      {brief && (
        <Card
          title={`${brief.company} — ${brief.role}`}
          description={new Date(current!.createdAt).toLocaleString()}
        >
          <div className="space-y-6">
            <p className="text-sm text-slate-700">{brief.overview}</p>

            <Block title="Interview process">
              <ol className="space-y-3">
                {brief.interviewProcess.map((stage, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-900">
                      <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                      {stage.stage}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{stage.whatToExpect}</p>
                    <p className="mt-1.5 text-sm text-slate-800">
                      <span className="font-medium text-brand-700">Prepare by: </span>
                      {stage.howToPrepare}
                    </p>
                  </li>
                ))}
              </ol>
            </Block>

            <Block title="Where to spend study time">
              <div className="flex flex-wrap gap-1.5">
                {brief.focusTopics.map((topic) => (
                  <Chip key={topic}>{topic}</Chip>
                ))}
              </div>
            </Block>

            <Block title="Likely questions">
              <ul className="space-y-2">
                {brief.likelyQuestions.map((q, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium text-slate-900">{q.question}</p>
                    <p className="text-slate-600">{q.whatTheyAreLookingFor}</p>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title="Ask them">
              <Bullets items={brief.questionsToAsk} />
            </Block>

            {/* The model is told to always fill this in; surfacing it prominently
                keeps a generated brief from reading as insider knowledge. */}
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
              {brief.caveat}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
