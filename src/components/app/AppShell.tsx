'use client'

interface AppShellProps {
  /** Omite slotul de header din shell când e `null` (ex. header randat în client). */
  header?: React.ReactNode | null
  children: React.ReactNode
  fab?: React.ReactNode
  bottomBar?: React.ReactNode
  bottomInset?: string
}

export function AppShell({
  header,
  children,
  fab,
  bottomBar,
  bottomInset = 'var(--app-nav-clearance)',
}: AppShellProps) {
  return (
    <div className="min-h-0 bg-[var(--agri-bg)]">
      {header != null ? <div className="relative z-20 lg:z-40">{header}</div> : null}

      <div
        className="relative z-10 px-[var(--shell-content-px)] sm:px-5 md:px-6"
        style={{ paddingBottom: bottomInset }}
      >
        <div className="mx-auto w-full max-w-md pb-28 pt-0.5 sm:max-w-full sm:pb-32 md:pt-1">{children}</div>
      </div>

      {bottomBar ? <div className="relative z-30">{bottomBar}</div> : null}
      {fab}
    </div>
  )
}
