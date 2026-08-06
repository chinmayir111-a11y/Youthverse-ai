import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, unwrapError } from '../../lib/api'
import { postSSE } from '../../lib/sse'
import { Alert, Button, Input } from '../../components/ui'
import type { ChatMessage, Citation } from '../../types'

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {citations.map((c, i) => (
        <span
          key={i}
          title={c.quote}
          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200"
        >
          {c.page ? `p. ${c.page}` : 'source'}
        </span>
      ))}
    </div>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
        }`}
      >
        {message.content}
        {!isUser && <CitationList citations={message.citations} />}
      </div>
    </div>
  )
}

export function ChatPanel({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .get(`/study/documents/${documentId}/chat`)
      .then(({ data }) => setMessages(data.data.session.messages))
      .catch((err) => setError(unwrapError(err).message))
  }, [documentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || busy) return

    setError('')
    setQuestion('')
    setBusy(true)
    setStreaming('')
    // Show the user's turn immediately rather than waiting for the round trip.
    setMessages((prev) => [...prev, { role: 'user', content: q, citations: [] }])

    let accumulated = ''
    try {
      await postSSE<{ text: string; citations: Citation[] }>(
        `/study/documents/${documentId}/chat`,
        { question: q },
        {
          onDelta: (text) => {
            accumulated += text
            setStreaming(accumulated)
          },
          onDone: (payload) => {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: payload.text, citations: payload.citations ?? [] },
            ])
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

  return (
    <div className="flex h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && !streaming && (
          <p className="py-8 text-center text-sm text-slate-500">
            Ask anything about this document — answers cite the page they came from.
          </p>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}

        {streaming && (
          <Bubble message={{ role: 'assistant', content: streaming, citations: [] }} />
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
          placeholder="Ask a question about this document…"
          disabled={busy}
        />
        <Button type="submit" loading={busy} disabled={!question.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
