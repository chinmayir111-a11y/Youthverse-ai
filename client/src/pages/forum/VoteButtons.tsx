export function VoteButtons({
  score,
  myVote,
  onVote,
  disabled,
}: {
  score: number
  myVote: number
  /** Clicking the active arrow clears the vote, so callers get 1 / -1 / 0. */
  onVote: (value: number) => void
  disabled?: boolean
}) {
  const arrow = (dir: 1 | -1) => {
    const active = myVote === dir
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={dir === 1 ? 'Upvote' : 'Downvote'}
        aria-pressed={active}
        onClick={() => onVote(active ? 0 : dir)}
        className={`grid h-6 w-6 place-items-center rounded text-sm transition disabled:opacity-40 ${
          active
            ? dir === 1
              ? 'bg-brand-100 text-brand-700'
              : 'bg-red-100 text-red-700'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        {dir === 1 ? '▲' : '▼'}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {arrow(1)}
      <span className="text-sm font-semibold text-slate-700 tabular-nums">{score}</span>
      {arrow(-1)}
    </div>
  )
}
