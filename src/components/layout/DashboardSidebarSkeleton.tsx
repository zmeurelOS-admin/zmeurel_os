/** Placeholder când sidebar-ul se încarcă doar pe client (evită mismatch Radix Collapsible + useId la hidratare). */
export function DashboardSidebarSkeleton() {
  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden w-[var(--sidebar-width)] border-r border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] md:flex"
      style={{ height: '100vh' }}
      aria-label="Navigare desktop"
      aria-busy="true"
    />
  )
}
