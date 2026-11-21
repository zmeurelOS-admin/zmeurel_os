export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-4" aria-busy="true" aria-label="Se încarcă rapoartele">
      <div className="h-touch animate-pulse rounded-box bg-surface-muted" />
      <div className="h-36 animate-pulse rounded-card bg-surface-muted" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[78px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[78px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[78px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[78px] animate-pulse rounded-box bg-surface-muted" />
      </div>
    </div>
  )
}
