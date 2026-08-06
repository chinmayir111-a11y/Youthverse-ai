import { useEffect, useState, type FormEvent } from 'react'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import { Block, Bullets, Chip, ScoreBar } from './shared'
import type { InterviewSession } from '../../types'

const LEVELS = [
  { value: 'intern', label: 'Intern' },
  { value: 'entry', label: 'Entry level' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid level' },
]

export function InterviewPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [active, setActive] = useState<InterviewSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New-interview form
  const [role, setRole] = useState('')
  const [level, setLevel] = useState('entry')
  const [focus, setFocus] = useState('')
  const [count, setCount] = useState('5')
  const [starting, setStarting] = useState(false)

  // Answering
  const [answers, setAnswers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [grading, setGrading] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api
      .get('/career/interviews')
      .then(({ data }) => setSessions(data.data.sessions))
      .catch((err) => setError(unwrapError(err).message))
      .finally(() => setLoading(false))
  }, [])

  const open = (session: InterviewSession) => {
    setActive(session)
    setAnswers(session.questions.map((q) => q.answer))
    setNotice('')
    setError('')
  }

  const start = async (e: FormEvent) => {
    e.preventDefault()
    if (!role.trim()) return
    setError('')
    setStarting(true)
    try {
      const { data } = await api.post('/career/interviews', {
        role: role.trim(),
        level,
        focus: focus.trim(),
        count: Number(count),
      })
      const session: InterviewSession = data.data.session
      setSessions((prev) => [session, ...prev])
      open(session)
      setRole('')
      setFocus('')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setStarting(false)
    }
  }

  /** Push answers to the server; returns false if the save failed. */
  const persist = async () => {
    if (!active) return false
    const { data } = await api.put(`/career/interviews/${active.id}/answers`, {
      answers: answers.map((answer, index) => ({ index, answer })),
    })
    const session: InterviewSession = data.data.session
    setActive(session)
    setSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)))
    return true
  }

  const save = async () => {
    setError('')
    setNotice('')
    setSaving(true)
    try {
      await persist()
      setNotice('Answers saved.')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const grade = async () => {
    if (!active) return
    setError('')
    setNotice('')
    setGrading(true)
    try {
      // Save first: grading reads what is stored, so an unsaved edit in the box
      // would otherwise be graded as if it were never written.
      await persist()
      const { data } = await api.post(`/career/interviews/${active.id}/feedback`)
      const session: InterviewSession = data.data.session
      setActive(session)
      setSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)))
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setGrading(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this interview and its feedback?')) return
    try {
      await api.delete(`/career/interviews/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setActive((prev) => (prev?.id === id ? null : prev))
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const graded = active?.status === 'graded'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mock Interviews</h1>
        <p className="mt-1 text-sm text-slate-600">
          Answer in your own words, then get graded on what you actually said.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card title="Start an interview">
        <form onSubmit={start} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Field label="Role">
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Backend Engineer"
              />
            </Field>
          </div>
          <Field label="Level">
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Questions">
            <Select value={count} onChange={(e) => setCount(e.target.value)}>
              {[3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <div className="min-w-[12rem] flex-1">
            <Field label="Focus (optional)">
              <Input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="databases, system design"
              />
            </Field>
          </div>
          <Button type="submit" loading={starting} disabled={!role.trim()}>
            Start
          </Button>
        </form>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading interviews…</p>
      ) : (
        sessions.length > 0 && (
          <Card title="Your interviews">
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <button
                    onClick={() => open(s)}
                    className={`text-left font-medium ${
                      active?.id === s.id ? 'text-brand-700' : 'text-slate-900 hover:text-brand-700'
                    }`}
                  >
                    {s.role}
                  </button>
                  <Chip tone={s.status === 'graded' ? 'good' : 'neutral'}>
                    {s.status === 'graded' ? `${s.feedback?.overallScore ?? 0}/100` : 'in progress'}
                  </Chip>
                  <span className="text-xs text-slate-500">
                    {s.answeredCount}/{s.questions.length} answered ·{' '}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => void remove(s.id)}
                    className="ml-auto text-xs font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      )}

      {active && (
        <Card
          title={`${active.role} · ${LEVELS.find((l) => l.value === active.level)?.label}`}
          description={
            graded
              ? 'Graded. Start a new interview to try again.'
              : 'Answer what you can, then ask for feedback.'
          }
        >
          <div className="space-y-5">
            {active.questions.map((question, i) => {
              const perQuestion = active.feedback?.perQuestion.find((p) => p.index === i)
              return (
                <div key={i} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Q{i + 1}</span>
                    <Chip>{question.category}</Chip>
                    {perQuestion && (
                      <Chip tone={perQuestion.score >= 7 ? 'good' : perQuestion.score >= 4 ? 'warn' : 'bad'}>
                        {perQuestion.score}/10
                      </Chip>
                    )}
                  </div>
                  <p className="mt-1.5 font-medium text-slate-900">{question.prompt}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    A strong answer covers: {question.whatGoodLooksLike}
                  </p>

                  <div className="mt-3">
                    <Textarea
                      rows={4}
                      value={answers[i] ?? ''}
                      disabled={graded}
                      onChange={(e) =>
                        setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
                      }
                      placeholder="Situation, what you did, the trade-off, the result…"
                      aria-label={`Answer to question ${i + 1}`}
                    />
                  </div>

                  {perQuestion && (
                    <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
                      <p>
                        <span className="font-medium text-emerald-700">Worked: </span>
                        {perQuestion.strengths}
                      </p>
                      <p>
                        <span className="font-medium text-amber-700">Improve: </span>
                        {perQuestion.improvements}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-700">Model answer: </span>
                        {perQuestion.modelAnswer}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}

            {!graded && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void save()} loading={saving}>
                  Save answers
                </Button>
                <Button onClick={() => void grade()} loading={grading}>
                  Get feedback
                </Button>
              </div>
            )}

            {active.feedback && (
              <div className="space-y-4 border-t border-slate-200 pt-5">
                <ScoreBar value={active.feedback.overallScore} label="Overall" />
                <p className="text-sm text-slate-700">{active.feedback.summary}</p>
                <Block title="Next steps">
                  <Bullets items={active.feedback.nextSteps} />
                </Block>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
