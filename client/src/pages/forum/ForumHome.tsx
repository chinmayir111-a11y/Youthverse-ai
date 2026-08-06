import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui'
import type { Community, Thread } from '../../types'

export function ForumHome() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Thread[] | null>(null)
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const { data } = await api.get('/forum/communities')
      setCommunities(data.data.communities)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const { data } = await api.post('/forum/communities', { name, description })
      navigate(`/community/${data.data.community.slug}`)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setCreating(false)
    }
  }

  const onSearch = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      setResults(null)
      return
    }
    setSearching(true)
    setError('')
    try {
      const { data } = await api.get('/forum/search', { params: { q } })
      setResults(data.data.threads)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ask questions, share what you're learning, help someone else out.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? 'Cancel' : 'New community'}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {showForm && (
        <Card title="Create a community">
          <form onSubmit={onCreate} className="space-y-4" noValidate>
            <Field label="Name" hint="3-60 characters. The URL slug is derived from this.">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Machine Learning"
                required
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What belongs in this community?"
              />
            </Field>
            <Button type="submit" loading={creating}>
              Create community
            </Button>
          </form>
        </Card>
      )}

      <Card title="Search discussions">
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search threads by title or body…"
          />
          <Button type="submit" loading={searching}>
            Search
          </Button>
        </form>

        {results !== null && (
          <div className="mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-slate-500">No threads matched "{query}".</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((t) => (
                  <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      to={`/community/thread/${t.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {t.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {typeof t.community === 'string' ? '' : t.community.name} · {t.score} points ·{' '}
                      {t.commentCount} replies
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title="Communities">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : communities.length === 0 ? (
          <p className="text-sm text-slate-500">
            No communities yet. Create the first one to get things started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {communities.map((c) => (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  to={`/community/${c.slug}`}
                  className="font-medium text-slate-900 hover:text-brand-700"
                >
                  {c.name}
                </Link>
                <p className="text-sm text-slate-600">{c.description}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.threadCount ?? 0} thread{c.threadCount === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
