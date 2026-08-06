import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { VoteButtons } from '../forum/VoteButtons'
import type { Resource, ResourceType, UserRef } from '../../types'

export const TYPE_LABEL: Record<ResourceType, string> = {
  notes: 'Notes',
  paper: 'Previous papers',
  template: 'Templates',
  book: 'Books',
  roadmap: 'Roadmaps',
  interview: 'Interview questions',
  cheatsheet: 'Cheat sheets',
}

/** Singular form, for a single card or the detail page. */
export const TYPE_ONE: Record<ResourceType, string> = {
  notes: 'Notes',
  paper: 'Previous paper',
  template: 'Template',
  book: 'Book',
  roadmap: 'Roadmap',
  interview: 'Interview questions',
  cheatsheet: 'Cheat sheet',
}

const TYPE_TONE: Record<ResourceType, string> = {
  notes: 'bg-sky-50 text-sky-800 ring-sky-200',
  paper: 'bg-amber-50 text-amber-900 ring-amber-200',
  template: 'bg-violet-50 text-violet-800 ring-violet-200',
  book: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  roadmap: 'bg-brand-50 text-brand-700 ring-brand-200',
  interview: 'bg-rose-50 text-rose-800 ring-rose-200',
  cheatsheet: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
}

export function TypeBadge({ type }: { type: ResourceType }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${TYPE_TONE[type]}`}>
      {TYPE_ONE[type]}
    </span>
  )
}

/** Uploader is populated on reads but can be a bare id elsewhere. */
export function uploaderOf(value: UserRef | string): UserRef | null {
  return typeof value === 'string' ? null : value
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Downloads go through axios rather than a plain `<a href>` because the
 * endpoint requires the bearer token, which a browser navigation would not
 * send. The blob is revoked immediately after the click so it isn't retained.
 */
export async function downloadResource(resource: Resource): Promise<void> {
  const response = await api.get(`/resources/${resource.id}/download`, { responseType: 'blob' })

  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = resource.file?.originalName ?? 'resource'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ResourceCard({
  resource,
  onVote,
  onToggleSave,
  footer,
}: {
  resource: Resource
  onVote?: (resource: Resource, value: number) => void
  onToggleSave?: (resource: Resource) => void
  footer?: React.ReactNode
}) {
  const uploader = uploaderOf(resource.uploadedBy)

  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      {onVote && (
        <VoteButtons
          score={resource.score}
          myVote={resource.myVote}
          onVote={(value) => onVote(resource, value)}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <TypeBadge type={resource.type} />
          {resource.subject && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {resource.subject}
            </span>
          )}
          {resource.hasFile && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {resource.file ? formatBytes(resource.file.sizeBytes) : 'File'}
            </span>
          )}
        </div>

        <Link
          to={`/resources/${resource.id}`}
          className="mt-2 block font-semibold text-slate-900 hover:text-brand-700"
        >
          {resource.title}
        </Link>

        {resource.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{resource.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {resource.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {uploader?.name ?? 'A member'}
            {resource.downloadCount > 0 && ` · ${resource.downloadCount} downloads`}
          </span>
          {onToggleSave && (
            <button
              onClick={() => onToggleSave(resource)}
              aria-pressed={resource.saved}
              aria-label={resource.saved ? `Unsave ${resource.title}` : `Save ${resource.title}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                resource.saved
                  ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {resource.saved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>

        {footer}
      </div>
    </div>
  )
}
