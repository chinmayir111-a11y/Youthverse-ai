import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'
import { Alert, Button, Card, Textarea } from '../../components/ui'
import { VoteButtons } from './VoteButtons'
import { authorOf, type Comment, type Thread } from '../../types'

export function ThreadDetail() {
  const { threadId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [thread, setThread] = useState<Thread | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [reply, setReply] = useState('')
  const [posting, setPosting] = useState(false)
  const [summarizing, setSummarizing] = useState(false)

  const isStaff = user?.role === 'moderator' || user?.role === 'admin'
  const threadAuthor = thread ? authorOf(thread.author) : null
  const canCurate = Boolean(user && (isStaff || threadAuthor?.id === user.id))

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/forum/threads/${threadId}`)
      setThread(data.data.thread)
      setComments(data.data.comments)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    void load()
  }, [load])

  const guard = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const voteThread = (value: number) =>
    guard(async () => {
      const { data } = await api.post(`/forum/threads/${threadId}/vote`, { value })
      setThread((t) => (t ? { ...t, score: data.data.thread.score, myVote: data.data.thread.myVote } : t))
    })

  const voteComment = (id: string, value: number) =>
    guard(async () => {
      const { data } = await api.post(`/forum/comments/${id}/vote`, { value })
      setComments((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, score: data.data.comment.score, myVote: data.data.comment.myVote } : c,
        ),
      )
    })

  const markBest = (commentId: string | null) =>
    guard(async () => {
      await api.post(`/forum/threads/${threadId}/best-answer`, { commentId })
      await load()
    })

  const removeComment = (id: string) =>
    guard(async () => {
      if (!window.confirm('Delete this comment?')) return
      await api.delete(`/forum/comments/${id}`)
      await load()
    })

  const removeThread = () =>
    guard(async () => {
      if (!window.confirm('Delete this whole thread and its replies?')) return
      await api.delete(`/forum/threads/${threadId}`)
      navigate('/community')
    })

  const toggleLock = () =>
    guard(async () => {
      await api.post(`/forum/threads/${threadId}/lock`, { locked: !thread?.locked })
      await load()
    })

  const summarize = () =>
    guard(async () => {
      setSummarizing(true)
      try {
        const { data } = await api.post(`/forum/threads/${threadId}/summary`)
        setThread(data.data.thread)
      } finally {
        setSummarizing(false)
      }
    })

  const onReply = async (e: FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return
    setPosting(true)
    await guard(async () => {
      await api.post(`/forum/threads/${threadId}/comments`, { body: reply })
      setReply('')
      await load()
    })
    setPosting(false)
  }

  if (loading) return <p className="text-sm text-slate-500">Loading thread…</p>
  if (!thread) return <Alert>{error || 'Thread not found.'}</Alert>

  const communitySlug = typeof thread.community === 'string' ? '' : thread.community.slug
  const communityName = typeof thread.community === 'string' ? 'community' : thread.community.name

  return (
    <div className="space-y-5">
      <Link
        to={communitySlug ? `/community/${communitySlug}` : '/community'}
        className="text-sm font-medium text-brand-600 hover:underline"
      >
        ← {communityName}
      </Link>

      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="flex gap-4">
          <VoteButtons score={thread.score} myVote={thread.myVote} onVote={(v) => void voteThread(v)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-xl font-bold text-slate-900">{thread.title}</h1>
              {thread.locked && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase">
                  Locked
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {threadAuthor?.name ?? 'Unknown'} · {new Date(thread.createdAt).toLocaleString()}
            </p>
            <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{thread.body}</p>

            {thread.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {thread.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {canCurate && (
                <Button variant="danger" onClick={() => void removeThread()}>
                  Delete thread
                </Button>
              )}
              {isStaff && (
                <Button variant="secondary" onClick={() => void toggleLock()}>
                  {thread.locked ? 'Unlock' : 'Lock'} thread
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="AI discussion summary"
        description="A neutral digest of the replies so far."
        actions={
          <Button variant="secondary" loading={summarizing} onClick={() => void summarize()}>
            {thread.summary ? 'Regenerate' : 'Summarise'}
          </Button>
        }
      >
        {thread.summaryStale && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            New replies have arrived since this was generated. Regenerate for an up-to-date summary.
          </p>
        )}

        {!thread.summary ? (
          <p className="text-sm text-slate-500">
            {comments.length === 0
              ? 'Nothing to summarise yet — this thread has no replies.'
              : 'No summary yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">{thread.summary.summary}</p>
            {thread.summary.keyPoints.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Key points
                </h4>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                  {thread.summary.keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {thread.summary.openQuestions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Open questions
                </h4>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                  {thread.summary.openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={`${comments.length} repl${comments.length === 1 ? 'y' : 'ies'}`}>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">No replies yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {comments.map((c) => {
              const author = authorOf(c.author)
              const mine = user && author?.id === user.id
              return (
                <li key={c.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <VoteButtons
                    score={c.score}
                    myVote={c.myVote}
                    onVote={(v) => void voteComment(c.id, v)}
                  />
                  <div className="min-w-0 flex-1">
                    {c.isBestAnswer && (
                      <span className="mb-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-800 uppercase">
                        Best answer
                      </span>
                    )}
                    <p className="text-sm whitespace-pre-wrap text-slate-700">{c.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {author?.name ?? 'Unknown'} · {new Date(c.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-2 flex gap-3 text-xs">
                      {canCurate && (
                        <button
                          onClick={() => void markBest(c.isBestAnswer ? null : c.id)}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {c.isBestAnswer ? 'Unmark best answer' : 'Mark as best answer'}
                        </button>
                      )}
                      {(mine || isStaff) && (
                        <button
                          onClick={() => void removeComment(c.id)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Add a reply">
        {thread.locked ? (
          <p className="text-sm text-slate-500">This thread is locked. No new replies can be added.</p>
        ) : (
          <form onSubmit={onReply} className="space-y-3" noValidate>
            <Textarea
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Share what you know…"
            />
            <Button type="submit" loading={posting} disabled={!reply.trim()}>
              Post reply
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
