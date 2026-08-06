import { Alert, Button } from '../../components/ui'
import type { NotesPayload } from '../../types'

export function NotesPanel({
  notes,
  onGenerate,
  generating,
  error,
}: {
  notes: NotesPayload | null
  onGenerate: () => void
  generating: boolean
  error: string
}) {
  return (
    <div className="space-y-4">
      <Button onClick={onGenerate} loading={generating}>
        {notes ? 'Regenerate notes' : 'Generate revision notes'}
      </Button>

      {error && <Alert>{error}</Alert>}

      {!notes && !generating && (
        <p className="text-sm text-slate-500">
          No notes yet. Generate structured revision notes from this document.
        </p>
      )}

      {notes && (
        <article className="space-y-6">
          <header>
            <h3 className="text-lg font-bold text-slate-900">{notes.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{notes.summary}</p>
          </header>

          {notes.sections.map((section, i) => (
            <section key={i}>
              <h4 className="mb-2 font-semibold text-slate-800">{section.heading}</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {section.points.map((point, j) => (
                  <li key={j}>{point}</li>
                ))}
              </ul>
            </section>
          ))}

          {notes.keyTerms.length > 0 && (
            <section>
              <h4 className="mb-2 font-semibold text-slate-800">Key terms</h4>
              <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {notes.keyTerms.map((t, i) => (
                  <div key={i} className="grid gap-1 px-3 py-2 sm:grid-cols-3">
                    <dt className="text-sm font-medium text-slate-900">{t.term}</dt>
                    <dd className="text-sm text-slate-600 sm:col-span-2">{t.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </article>
      )}
    </div>
  )
}
