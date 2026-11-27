/** Locul barei laterale cât se încarcă (doar pe client): aceeași lățime și culoare, fără conținut. */
export function DashboardSidebarSkeleton() {
  return (
    <aside
      className="fixed left-0 top-0 z-nav hidden h-screen w-[var(--sidebar-width)] border-r border-border bg-surface md:flex"
      aria-label="Navigare desktop"
      aria-busy="true"
    />
  )
}
