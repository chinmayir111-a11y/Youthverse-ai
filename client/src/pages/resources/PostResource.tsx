import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea, fieldError } from '../../components/ui'
import { TYPE_ONE, formatBytes } from './shared'
import type { FieldError, ResourceType } from '../../types'

const TYPES: ResourceType[] = [
  'notes',
  'paper',
  'template',
  'book',
  'roadmap',
  'interview',
  'cheatsheet',
]

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.zip'
const MAX_BYTES = 25 * 1024 * 1024

const blank = {
  type: 'notes' as ResourceType,
  title: '',
  description: '',
  subject: '',
  link: '',
  tags: '',
}

export function PostResource() {
  const { resourceId } = useParams()
  const isEdit = Boolean(resourceId)
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState(blank)
  const [file, setFile] = useState<File | null>(null)
  const [existingFile, setExistingFile] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<FieldError[]>([])

  useEffect(() => {
    if (!resourceId) return
    api
      .get(`/resources/${resourceId}`)
      .then(({ data }) => {
        const r = data.data.resource
        if (!r.canManage) {
          setError('You can only edit a resource you uploaded.')
          return
        }
        setForm({
          type: r.type,
          title: r.title,
          description: r.description,
          subject: r.subject,
          link: r.link,
          tags: r.tags.join(', '),
        })
        setExistingFile(r.file?.originalName ?? null)
      })
      .catch((err) => setError(unwrapError(err).message))
  }, [resourceId])

  const set = (updates: Partial<typeof blank>) => setForm((prev) => ({ ...prev, ...updates }))

  const pickFile = (chosen: File | null) => {
    if (chosen && chosen.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(chosen.size)}. The limit is 25 MB.`)
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setError('')
    setFile(chosen)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFields([])

    if (!isEdit && !file && !form.link.trim()) {
      setError('Attach a file or paste a link — a resource needs something to open.')
      return
    }

    setSaving(true)
    try {
      let data

      if (isEdit) {
        // Metadata only: the file is fixed once uploaded, so editing never
        // sends multipart.
        ;({ data } = await api.patch(`/resources/${resourceId}`, {
          ...form,
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }))
      } else if (file) {
        const body = new FormData()
        Object.entries(form).forEach(([key, value]) => body.append(key, String(value)))
        body.append('file', file)
        // Let the browser set the multipart boundary; a hand-written
        // Content-Type would omit it and the upload would parse as empty.
        ;({ data } = await api.post('/resources', body, {
          headers: { 'Content-Type': undefined },
        }))
      } else {
        ;({ data } = await api.post('/resources', {
          ...form,
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }))
      }

      navigate(`/resources/${data.data.resource.id}`)
    } catch (err) {
      const unwrapped = unwrapError(err)
      setError(unwrapped.message)
      setFields(unwrapped.fields)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/resources" className="text-sm font-medium text-brand-600 hover:underline">
          ← All resources
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit resource' : 'Share a resource'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload only what you have the right to share. Say which course and year it's from —
          that's what makes it findable.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" error={fieldError(fields, 'type')}>
              <Select
                value={form.type}
                onChange={(e) => set({ type: e.target.value as ResourceType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_ONE[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" hint="The course, paper, or role it belongs to.">
              <Input
                value={form.subject}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="Data Structures"
              />
            </Field>
          </div>

          <Field label="Title" error={fieldError(fields, 'title')}>
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="DSA end-semester paper, 2025"
              required
            />
          </Field>

          <Field
            label="Description"
            hint="What it covers, how complete it is, and anything a reader should know."
          >
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>

          {isEdit ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {existingFile ? (
                <>
                  Attached file: <span className="font-medium text-slate-800">{existingFile}</span>.
                  Files can't be swapped after upload — post a new resource instead.
                </>
              ) : (
                'This resource is a link. Files can only be attached when first shared.'
              )}
            </div>
          ) : (
            <Field label="File" hint={`Up to 25 MB. ${ACCEPT.replaceAll('.', '').replaceAll(',', ', ')}`}>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {file && (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} · {formatBytes(file.size)}
                </p>
              )}
            </Field>
          )}

          <Field
            label={isEdit || file ? 'Link (optional)' : 'Link'}
            hint={
              file
                ? "You've attached a file, so a link is optional."
                : 'Where it lives, if you are not uploading a file.'
            }
          >
            <Input
              value={form.link}
              onChange={(e) => set({ link: e.target.value })}
              placeholder="https://…"
            />
          </Field>

          <Field label="Tags" hint="Comma separated.">
            <Input
              value={form.tags}
              onChange={(e) => set({ tags: e.target.value })}
              placeholder="semester-4, endsem"
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Share resource'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/resources')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
