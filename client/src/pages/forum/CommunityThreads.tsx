import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui'
import { VoteButtons } from './VoteButtons'
import { authorOf, type Community, type Thread } from '../../types'

type Sort = 'new' | 'top'

export function CommunityThreads() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<Community | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [sort, setSort] = useState<Sort>('new')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/forum/communities/${slug}/threads`, { params: { sort } })
      setCommunity(data.data.community)
      setThreads(data.data.threads)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [slug, sort])

  useEffect(() => {
    void load()
  }, [load])

  const onVote = async (thread: Thread, value: number) => {
    try {
      const { data } = await api.post(`/forum/threads/${thread.id}/vote`, { value })
      const updated: Thread = data.data.thread
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, score: updated.score, myVote: updated.myVote } : t)),
      )
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const onPost = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setPosting(true)
    try {
      const { data } = await api.post(`/forum/communities/${slug}/threads`, {
        title,
        body,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      navigate(`/community/thread/${data.data.thread.id}`)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setPosting(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading community…</p>

  return (
    <div className="space-y-5">
      <div>
        <Link to="/community" className="text-sm font-medium text-brand-600 hover:underline">
          ← All communities
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{community?.name ?? slug}</h1>
            {community?.description && (
              <p className="mt-1 text-sm text-slate-600">{community.description}</p>
            )}
          </div>
          <Button
            onClick={() => setShowForm((v) => !v)}
            variant={showForm ? 'secondary' : 'primary'}
          >
            {showForm ? 'Cancel' : 'New thread'}
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {showForm && (
        <Card title="Start a discussion">
          <form onSubmit={onPost} className="space-y-4" noValidate>
            <Field label="Title" hint="5-200 characters.">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How do I start with gradient descent?"
                required
              />
            </Field>
            <Field label="Body" hint="At least 10 characters.">
              <Textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Give enough context that someone can actually help."
                required
              />
            </Field>
            <Field label="Tags" hint="Comma-separated, up to 10.">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="beginner, math"
              />
            </Field>
            <Button type="submit" loading={posting}>
              Post thread
            </Button>
          </form>
        </Card>
      )}

      <div className="flex gap-1">
        {(['new', 'top'] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              sort === s ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Card>
        {threads.length === 0 ? (
          <p className="text-sm text-slate-500">
            No threads yet. Be the first to post one.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {threads.map((t) => {
              const author = authorOf(t.author)
              return (
                <li key={t.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <VoteButtons
                    score={t.score}
                    myVote={t.myVote}
                    onVote={(v) => void onVote(t, v)}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/community/thread/${t.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {t.title}
                    </Link>
                    {t.locked && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
                        Locked
                      </span>
                    )}
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{t.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {author?.name ?? 'Unknown'} · {t.commentCount} repl
                      {t.commentCount === 1 ? 'y' : 'ies'} ·{' '}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                    {t.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
