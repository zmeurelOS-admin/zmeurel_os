export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-modul space-y-5 px-[var(--shell-content-px)] pt-[max(var(--safe-t),8px)]" aria-busy="true" aria-label="Se încarcă">
      <div className="h-12 w-40 animate-pulse rounded-box bg-surface-muted" />
      {[3, 2, 2, 2].map((rows, index) => (
        <div key={index} className="space-y-2">
          <div className="h-5 w-28 animate-pulse rounded-control bg-surface-muted" />
          <div className="animate-pulse rounded-box bg-surface-muted" style={{ height: rows * 60 }} />
        </div>
      ))}
    </div>
  )
}
