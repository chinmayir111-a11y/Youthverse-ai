import { useState } from 'react'
import { Alert, Button, Select } from '../../components/ui'
import type { QuizPayload } from '../../types'

export function QuizPanel({
  quiz,
  onGenerate,
  generating,
  error,
}: {
  quiz: QuizPayload | null
  onGenerate: (count: number) => void
  generating: boolean
  error: string
}) {
  const [count, setCount] = useState(5)
  // questionIndex -> chosen option index
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const reset = () => {
    setAnswers({})
    setSubmitted(false)
  }

  const score = quiz
    ? quiz.questions.reduce((n, q, i) => (answers[i] === q.correctIndex ? n + 1 : n), 0)
    : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Questions</span>
          <Select
            value={String(count)}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-28"
          >
            {[3, 5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <Button
          onClick={() => {
            reset()
            onGenerate(count)
          }}
          loading={generating}
        >
          {quiz ? 'Regenerate quiz' : 'Generate quiz'}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!quiz && !generating && (
        <p className="text-sm text-slate-500">
          No quiz yet. Generate one from this document to test yourself.
        </p>
      )}

      {quiz && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{quiz.title}</h3>
            {submitted && (
              <span className="text-sm font-semibold text-brand-700">
                {score} / {quiz.questions.length} correct
              </span>
            )}
          </div>

          {quiz.questions.map((q, qi) => {
            const chosen = answers[qi]
            return (
              <fieldset key={qi} className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Question {qi + 1}
                  {q.sourcePage ? ` · p. ${q.sourcePage}` : ''}
                </legend>
                <p className="mb-3 text-sm font-medium text-slate-900">{q.question}</p>

                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => {
                    // After submitting, colour the correct answer green and a
                    // wrong pick red; before that, just show the selection.
                    let tone = 'border-slate-200 hover:bg-slate-50'
                    if (submitted && oi === q.correctIndex) {
                      tone = 'border-emerald-300 bg-emerald-50'
                    } else if (submitted && oi === chosen) {
                      tone = 'border-red-300 bg-red-50'
                    } else if (!submitted && oi === chosen) {
                      tone = 'border-brand-400 bg-brand-50'
                    }

                    return (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${tone}`}
                      >
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          className="mt-0.5"
                          checked={chosen === oi}
                          disabled={submitted}
                          onChange={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                        />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>

                {submitted && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {q.explanation}
                  </p>
                )}
              </fieldset>
            )
          })}

          <div className="flex gap-2">
            {!submitted ? (
              <Button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length !== quiz.questions.length}
              >
                Submit answers
              </Button>
            ) : (
              <Button variant="secondary" onClick={reset}>
                Try again
              </Button>
            )}
            {!submitted && Object.keys(answers).length !== quiz.questions.length && (
              <span className="self-center text-xs text-slate-500">
                {quiz.questions.length - Object.keys(answers).length} unanswered
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
