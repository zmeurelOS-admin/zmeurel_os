export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-modul space-y-4 px-4 py-3" aria-busy="true" aria-label="Se încarcă recoltările">
      <div className="h-56 animate-pulse rounded-card bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
      </div>
    </div>
  )
}
