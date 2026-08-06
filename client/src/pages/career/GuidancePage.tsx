import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { postSSE } from '../../lib/sse'
import { Alert, Button, Card, Input } from '../../components/ui'

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'Is an unpaid internship worth it for experience?',
  'How do I choose between a startup and a service company?',
  'What should I build to stand out for a backend role?',
  'How many applications should I be sending a week?',
]

export function GuidancePage() {
  const [messages, setMessages] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .get('/career/guidance')
      .then(({ data }) => setMessages(data.data.session.messages))
      .catch((err) => setError(unwrapError(err).message))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const ask = async (raw: string) => {
    const q = raw.trim()
    if (!q || busy) return

    setError('')
    setQuestion('')
    setBusy(true)
    setStreaming('')
    setMessages((prev) => [...prev, { role: 'user', content: q }])

    let accumulated = ''
    try {
      await postSSE<{ text: string }>(
        '/career/guidance',
        { question: q },
        {
          onDelta: (text) => {
            accumulated += text
            setStreaming(accumulated)
          },
          onDone: (payload) => {
            setMessages((prev) => [...prev, { role: 'assistant', content: payload.text }])
            setStreaming('')
          },
          onError: (message) => {
            setError(message)
            setStreaming('')
          },
        },
      )
    } catch (err) {
      setError(unwrapError(err).message)
      setStreaming('')
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    if (!window.confirm('Clear this conversation?')) return
    try {
      await api.delete('/career/guidance')
      setMessages([])
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void ask(question)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Career Guidance</h1>
          <p className="mt-1 text-sm text-slate-600">
            The coach reads{' '}
            <Link to="/profile" className="font-medium text-brand-600 hover:underline">
              your profile
            </Link>
            , so advice is about you rather than students in general.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" onClick={() => void clear()}>
            Clear chat
          </Button>
        )}
      </div>

      <Card>
        <div className="flex h-[60vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && !streaming && (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500">Not sure where to start?</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm whitespace-pre-wrap text-slate-800">
                  {streaming}
                </div>
              </div>
            )}

            {busy && !streaming && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                  Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="pt-3">
              <Alert>{error}</Alert>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-100 pt-3">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about roles, timelines, or what to do next…"
              disabled={busy}
            />
            <Button type="submit" loading={busy} disabled={!question.trim()}>
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
