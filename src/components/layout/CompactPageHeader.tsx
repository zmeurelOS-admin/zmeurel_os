'use client'

import { HeaderBetaBadge, HeaderFeedbackButton } from '@/components/app/BetaBanner'

interface CompactPageHeaderProps {
  title?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
}

export function CompactPageHeader({ title, subtitle, rightSlot, summary }: CompactPageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 overflow-hidden border-b border-black/5 px-[14px] pb-[10px] pt-[calc(var(--safe-t)+10px)] backdrop-blur-md lg:static lg:z-40 lg:overflow-visible lg:border-b-0 lg:px-8 lg:pb-6 lg:pt-4 lg:backdrop-blur-none xl:px-10">
      <div className="absolute inset-0 bg-[var(--agri-bg)]/95 lg:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-b from-emerald-600 to-emerald-700 lg:block" />

      <div className="relative mx-auto w-full max-w-7xl">
        {(title || subtitle) && (
          <>
            <div className="flex min-h-[58px] items-start justify-between gap-3 lg:hidden">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  {title ? <h1 className="truncate text-[22px] font-semibold leading-[1.05] text-[var(--agri-text)]">{title}</h1> : null}
                  <HeaderBetaBadge />
                </div>
                {subtitle ? <p className="mt-1 line-clamp-2 text-[13px] leading-4 text-[color:rgba(16,32,21,0.72)]">{subtitle}</p> : null}
              </div>
              <div className="shrink-0 pt-0.5">
                <HeaderFeedbackButton />
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
