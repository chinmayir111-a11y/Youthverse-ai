import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Card } from '../../components/ui'
import { ChatPanel } from './ChatPanel'
import { QuizPanel } from './QuizPanel'
import { FlashcardsPanel } from './FlashcardsPanel'
import { NotesPanel } from './NotesPanel'
import type {
  ArtifactKind,
  FlashcardsPayload,
  NotesPayload,
  QuizPayload,
  StudyArtifact,
  StudyDocument,
} from '../../types'

const TABS = [
  { key: 'chat', label: 'Chat' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'notes', label: 'Notes' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function DocumentWorkspace() {
  const { documentId = '' } = useParams()
  const [doc, setDoc] = useState<StudyDocument | null>(null)
  const [tab, setTab] = useState<TabKey>('chat')
  const [loadError, setLoadError] = useState('')

  // Most recent artifact of each kind, so a reload shows previous work.
  const [quiz, setQuiz] = useState<QuizPayload | null>(null)
  const [deck, setDeck] = useState<FlashcardsPayload | null>(null)
  const [notes, setNotes] = useState<NotesPayload | null>(null)

  const [generating, setGenerating] = useState<ArtifactKind | null>(null)
  const [genError, setGenError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [docRes, artRes] = await Promise.all([
          api.get(`/study/documents/${documentId}`),
          api.get(`/study/documents/${documentId}/artifacts`),
        ])
        if (cancelled) return

        setDoc(docRes.data.data.document)

        // The list is newest-first, so the first hit per kind is the latest.
        const artifacts: StudyArtifact[] = artRes.data.data.artifacts
        const latest = (kind: ArtifactKind) => artifacts.find((a) => a.kind === kind)?.payload
        setQuiz((latest('quiz') as QuizPayload) ?? null)
        setDeck((latest('flashcards') as FlashcardsPayload) ?? null)
        setNotes((latest('notes') as NotesPayload) ?? null)
      } catch (err) {
        if (!cancelled) setLoadError(unwrapError(err).message)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [documentId])

  const generate = useCallback(
    async (kind: ArtifactKind, body: Record<string, unknown> = {}) => {
      setGenError('')
      setGenerating(kind)
      try {
        const { data } = await api.post(`/study/documents/${documentId}/${kind}`, body)
        const payload = data.data.artifact.payload
        if (kind === 'quiz') setQuiz(payload)
        else if (kind === 'flashcards') setDeck(payload)
        else setNotes(payload)
      } catch (err) {
        setGenError(unwrapError(err).message)
      } finally {
        setGenerating(null)
      }
    },
    [documentId],
  )

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert>{loadError}</Alert>
        <Link to="/study" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to documents
        </Link>
      </div>
    )
  }

  if (!doc) return <p className="text-sm text-slate-500">Loading document…</p>

  return (
    <div className="space-y-5">
      <div>
        <Link to="/study" className="text-sm font-medium text-brand-600 hover:underline">
          ← All documents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{doc.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{doc.originalName}</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1" role="tablist" aria-label="Study tools">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <Card>
        {tab === 'chat' && <ChatPanel documentId={documentId} />}
        {tab === 'quiz' && (
          <QuizPanel
            quiz={quiz}
            generating={generating === 'quiz'}
            error={genError}
            onGenerate={(count) => void generate('quiz', { count })}
          />
        )}
        {tab === 'flashcards' && (
          <FlashcardsPanel
            deck={deck}
            generating={generating === 'flashcards'}
            error={genError}
            onGenerate={(count) => void generate('flashcards', { count })}
          />
        )}
        {tab === 'notes' && (
          <NotesPanel
            notes={notes}
            generating={generating === 'notes'}
            error={genError}
            onGenerate={() => void generate('notes')}
          />
        )}
      </Card>
    </div>
  )
}
