import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import type { StudyDocument } from '../../types'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function StudyHome() {
  const [documents, setDocuments] = useState<StudyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const { data } = await api.get('/study/documents')
      setDocuments(data.data.documents)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onUpload = async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      // Let axios set the multipart boundary itself.
      await api.post('/study/documents', body, { headers: { 'Content-Type': undefined } })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDelete = async (doc: StudyDocument) => {
    if (!window.confirm(`Delete "${doc.title}"? Its chats and quizzes go too.`)) return
    setError('')
    try {
      await api.delete(`/study/documents/${doc.id}`)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Study Hub</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a PDF, then chat with it, generate quizzes, flashcards, and revision notes.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card title="Upload a document" description="PDF only, up to 25 MB.">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onUpload(file)
            }}
            className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
          {uploading && <span className="text-sm text-slate-500">Uploading…</span>}
        </div>
      </Card>

      <Card title="Your documents">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing here yet. Upload a PDF above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/study/${doc.id}`}
                    className="block truncate font-medium text-slate-900 hover:text-brand-700"
                  >
                    {doc.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {doc.originalName} · {formatSize(doc.sizeBytes)} ·{' '}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  to={`/study/${doc.id}`}
                  className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  Open
                </Link>
                <Button variant="secondary" onClick={() => void onDelete(doc)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
