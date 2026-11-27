/** Acasă se încarcă: aceeași coloană ca pagina (promptul 34, §10). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-modul space-y-3 p-4" aria-busy="true" aria-label="Se încarcă Acasă">
      <div className="h-10 animate-pulse rounded-box bg-surface-muted" />
      <div className="h-28 animate-pulse rounded-box bg-surface-muted" />
      <div className="h-40 animate-pulse rounded-box bg-surface-muted" />
    </div>
  )
}
