'use client'

interface CompactPageHeaderProps {
  title?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
}

export function CompactPageHeader({ title, subtitle, rightSlot, summary }: CompactPageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 overflow-hidden border-b border-[var(--surface-divider)] px-[14px] pb-[6px] pt-[calc(var(--safe-t)+8px)] backdrop-blur-md lg:static lg:z-40 lg:overflow-visible lg:border-b-0 lg:px-8 lg:pb-6 lg:pt-4 lg:backdrop-blur-none xl:px-10">
      <div className="absolute inset-0 bg-[var(--agri-bg)]/95 lg:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-b from-emerald-600 to-emerald-700 lg:block" />

      <div className="relative mx-auto w-full max-w-7xl">
        {(title || subtitle) && (
          <>
            <div className="flex min-h-[44px] items-center justify-between gap-3 lg:hidden">
              <div className="min-w-0 flex-1">
                {title ? <h1 className="truncate text-[20px] font-semibold leading-[1.1] text-[var(--agri-text)]">{title}</h1> : null}
                {subtitle ? <p className="line-clamp-1 text-[12px] leading-4 text-[var(--agri-text-muted)]">{subtitle}</p> : null}
              </div>
            </div>

            <div className="hidden items-start justify-between gap-3 lg:flex lg:items-center">
              <div className="min-w-0 space-y-0.5">
                {title ? <h1 className="truncate text-2xl font-semibold text-white">{title}</h1> : null}
                {subtitle ? <p className="line-clamp-2 text-sm text-emerald-100">{subtitle}</p> : null}
              </div>
              {rightSlot ? <div className="hidden shrink-0 text-white md:flex lg:items-center lg:justify-end">{rightSlot}</div> : null}
            </div>
          </>
        )}

        {summary ? <div className="mt-2 lg:mt-3">{summary}</div> : null}
      </div>
    </header>
  )
}
