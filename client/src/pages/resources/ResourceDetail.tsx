import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import { VoteButtons } from '../forum/VoteButtons'
import { TYPE_ONE, TypeBadge, downloadResource, formatBytes, uploaderOf } from './shared'
import type { Resource } from '../../types'

export function ResourceDetail() {
  const { resourceId = '' } = useParams()
  const navigate = useNavigate()

  const [resource, setResource] = useState<Resource | null>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/resources/${resourceId}`)
      setResource(data.data.resource)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }, [resourceId])

  useEffect(() => {
    void load()
  }, [load])

  const vote = async (value: number) => {
    if (!resource) return
    try {
      const { data } = await api.post(`/resources/${resource.id}/vote`, { value })
      setResource(data.data.resource)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const toggleSave = async () => {
    if (!resource) return
    const next = !resource.saved
    setResource({ ...resource, saved: next })
    try {
      if (next) await api.post(`/resources/${resource.id}/save`)
      else await api.delete(`/resources/${resource.id}/save`)
    } catch (err) {
      setError(unwrapError(err).message)
      setResource({ ...resource, saved: !next })
    }
  }

  const download = async () => {
    if (!resource) return
    setError('')
    setDownloading(true)
    try {
      await downloadResource(resource)
      // The count is incremented server-side; re-read so the page agrees.
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setDownloading(false)
    }
  }

  const remove = async () => {
    if (!resource) return
    if (!window.confirm(`Delete "${resource.title}"? The file goes with it.`)) return
    try {
      await api.delete(`/resources/${resource.id}`)
      navigate('/resources')
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  if (error && !resource) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link to="/resources" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to resources
        </Link>
      </div>
    )
  }

  if (!resource) return <p className="text-sm text-slate-500">Loading…</p>

  const uploader = uploaderOf(resource.uploadedBy)

  return (
    <div className="space-y-5">
      <Link to="/resources" className="text-sm font-medium text-brand-600 hover:underline">
        ← All resources
      </Link>

      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="flex gap-4">
          <VoteButtons score={resource.score} myVote={resource.myVote} onVote={(v) => void vote(v)} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <TypeBadge type={resource.type} />
              {resource.subject && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {resource.subject}
                </span>
              )}
            </div>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">{resource.title}</h1>
            <p className="text-sm text-slate-500">
              Shared by {uploader?.name ?? 'a member'} ·{' '}
              {new Date(resource.createdAt).toLocaleDateString()}
              {resource.downloadCount > 0 && ` · ${resource.downloadCount} downloads`}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {resource.hasFile && (
                <Button loading={downloading} onClick={() => void download()}>
                  Download{resource.file ? ` (${formatBytes(resource.file.sizeBytes)})` : ''}
                </Button>
              )}
              {resource.link && (
                <a
                  href={resource.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open link →
                </a>
              )}
              <Button variant="secondary" onClick={() => void toggleSave()}>
                {resource.saved ? 'Saved' : 'Save'}
              </Button>
              {resource.canManage && (
                <>
                  <Link
                    to={`/resources/${resource.id}/edit`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                  <Button variant="danger" onClick={() => void remove()}>
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title={`About this ${TYPE_ONE[resource.type].toLowerCase()}`}>
        {resource.description ? (
          <p className="text-sm whitespace-pre-wrap text-slate-700">{resource.description}</p>
        ) : (
          <p className="text-sm text-slate-500">No description was added.</p>
        )}

        {resource.file && (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">File</dt>
              <dd className="text-sm break-all text-slate-800">{resource.file.originalName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Size</dt>
              <dd className="text-sm text-slate-800">{formatBytes(resource.file.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Type</dt>
              <dd className="text-sm text-slate-800">{resource.file.mimeType}</dd>
            </div>
          </dl>
        )}

        {resource.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {resource.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
