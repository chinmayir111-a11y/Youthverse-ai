import { useEffect, useState } from 'react'
import { Alert, Button, Select } from '../../components/ui'
import type { FlashcardsPayload } from '../../types'

export function FlashcardsPanel({
  deck,
  onGenerate,
  generating,
  error,
}: {
  deck: FlashcardsPayload | null
  onGenerate: (count: number) => void
  generating: boolean
  error: string
}) {
  const [count, setCount] = useState(8)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  // A regenerated deck should start from the first card, not wherever the last
  // one left off (which could be past the end of the new deck).
  useEffect(() => {
    setIndex(0)
    setFlipped(false)
  }, [deck])

  const cards = deck?.cards ?? []
  const card = cards[index]

  const step = (delta: number) => {
    setFlipped(false)
    setIndex((i) => (i + delta + cards.length) % cards.length)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Cards</span>
          <Select
            value={String(count)}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-28"
          >
            {[5, 8, 12, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <Button onClick={() => onGenerate(count)} loading={generating}>
          {deck ? 'Regenerate deck' : 'Generate flashcards'}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!deck && !generating && (
        <p className="text-sm text-slate-500">
          No flashcards yet. Generate a deck to start reviewing.
        </p>
      )}

      {card && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Show front of card' : 'Reveal answer'}
            className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm transition hover:border-brand-300"
          >
            <span className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              {flipped ? 'Answer' : 'Prompt'}
            </span>
            <span className="text-base font-medium text-slate-900">
              {flipped ? card.back : card.front}
            </span>
            {!flipped && (
              <span className="mt-3 text-xs text-slate-400">Click to reveal</span>
            )}
            {flipped && card.sourcePage && (
              <span className="mt-3 text-xs text-slate-400">Source: p. {card.sourcePage}</span>
            )}
          </button>

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => step(-1)}>
              ← Previous
            </Button>
            <span className="text-sm text-slate-500 tabular-nums">
              {index + 1} / {cards.length}
            </span>
            <Button variant="secondary" onClick={() => step(1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
