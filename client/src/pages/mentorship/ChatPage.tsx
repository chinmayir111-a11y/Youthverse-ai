import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Input } from '../../components/ui'
import { Avatar } from './shared'
import type { ChatSummary, MentorshipChat, UserRef } from '../../types'

export function ChatPage() {
  const { userId } = useParams()
  const navigate = useNavigate()

  const [threads, setThreads] = useState<ChatSummary[]>([])
  const [chat, setChat] = useState<MentorshipChat | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThreads = async () => {
    try {
      const { data } = await api.get('/mentorship/chats')
      setThreads(data.data.chats)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  useEffect(() => {
    void loadThreads()
  }, [])

  useEffect(() => {
    if (!userId) {
      setChat(null)
      return
    }
    let cancelled = false
    api
      .get(`/mentorship/chats/${userId}`)
      .then(({ data }) => {
        if (cancelled) return
        setChat(data.data.chat)
        // Opening marks messages read server-side, so the sidebar badge is stale.
        void loadThreads()
      })
      .catch((err) => !cancelled && setError(unwrapError(err).message))
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !userId || sending) return

    setError('')
    setSending(true)
    try {
      const { data } = await api.post(`/mentorship/chats/${userId}`, { body })
      setChat(data.data.chat)
      setDraft('')
      void loadThreads()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSending(false)
    }
  }

  const other: UserRef | undefined = chat?.participants.find(
    (p): p is UserRef => typeof p !== 'string' && p.id === userId,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="mt-1 text-sm text-slate-600">
            Direct conversations with mentors and mentees.
          </p>
        </div>
        <Link
          to="/mentorship"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Find a mentor
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card title="Conversations">
          {threads.length === 0 ? (
            <p className="text-sm text-slate-500">
              No conversations yet. Open a mentor's page and hit Message.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    onClick={() => navigate(`/mentorship/chat/${thread.withUser.id}`)}
                    className={`flex w-full items-center gap-3 py-2.5 text-left ${
                      thread.withUser.id === userId ? 'text-brand-700' : 'text-slate-800'
                    }`}
                  >
                    <Avatar name={thread.withUser.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {thread.withUser.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {thread.lastMessage?.body ?? 'No messages yet'}
                      </span>
                    </span>
                    {thread.unreadCount > 0 && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {thread.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={other ? other.name : 'Select a conversation'}>
          {!userId ? (
            <p className="text-sm text-slate-500">
              Pick a conversation on the left, or message a mentor from their page.
            </p>
          ) : (
            <div className="flex h-[55vh] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {chat?.messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No messages yet. Say what you're working on and what you need.
                  </p>
                )}

                {chat?.messages.map((message, i) => (
                  <div key={i} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        message.mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {message.body}
                      <span
                        className={`mt-1 block text-[11px] ${
                          message.mine ? 'text-white/70' : 'text-slate-500'
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleString([], {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}

                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="flex gap-2 border-t border-slate-100 pt-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  disabled={sending}
                  aria-label="Message"
                />
                <Button type="submit" loading={sending} disabled={!draft.trim()}>
                  Send
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
