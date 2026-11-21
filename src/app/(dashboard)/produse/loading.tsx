export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-2 p-4" aria-busy="true" aria-label="Se încarcă produsele">
      <div className="h-touch animate-pulse rounded-box bg-surface-muted" />
      <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
      <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
    </div>
  )
}
