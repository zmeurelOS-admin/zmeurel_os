export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-modul space-y-3 p-4" aria-busy="true" aria-label="Se încarcă stocul">
      <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
      <div className="h-52 animate-pulse rounded-box bg-surface-muted" />
    </div>
  )
}
