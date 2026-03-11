'use client'

interface CompactPageHeaderProps {
  title?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
}

export function CompactPageHeader({ title, subtitle, rightSlot, summary }: CompactPageHeaderProps) {
  return (
    <header className="sticky top-9 z-30 overflow-hidden rounded-b-2xl border-b border-black/5 px-4 pt-[calc(var(--safe-t)+8px)] pb-2 backdrop-blur-md sm:px-6 sm:pt-[calc(var(--safe-t)+16px)] sm:pb-5 lg:static lg:z-40 lg:overflow-visible lg:border-b-0 lg:px-8 lg:backdrop-blur-none xl:px-10">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/90 to-emerald-700/90 lg:from-emerald-600 lg:to-emerald-700" />

      <div className="relative mx-auto w-full max-w-4xl lg:mx-0 lg:max-w-none">
        {(title || subtitle || rightSlot) && (
          <div className="flex items-start justify-between gap-3 lg:flex lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              {title ? <h1 className="truncate text-lg font-semibold text-white sm:text-2xl">{title}</h1> : null}
              {subtitle ? <p className="text-[11px] text-emerald-100 sm:text-sm">{subtitle}</p> : null}
            </div>
            {rightSlot ? <div className="shrink-0 text-white lg:flex lg:items-center lg:justify-end">{rightSlot}</div> : null}
          </div>
        )}

        {summary ? <div className="mt-2">{summary}</div> : null}
      </div>
    </header>
  )
}
