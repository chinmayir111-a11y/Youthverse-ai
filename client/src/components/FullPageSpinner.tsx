export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-screen items-center justify-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-brand-600" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}
