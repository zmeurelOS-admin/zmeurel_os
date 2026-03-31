'use client'

import { cn } from '@/lib/utils'

interface CompactPageHeaderProps {
  title?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
  className?: string
  /** Afișează rightSlot pe mobil (ex. acțiuni dashboard), lângă titlu. */
  showMobileRightSlot?: boolean
  /** Pe mobil, rightSlot pe rând separat sub titlu (evită înghesuirea). */
  stackMobileRightSlotBelow?: boolean
}

export function CompactPageHeader({
  title,
  subtitle,
  rightSlot,
  summary,
  className,
  showMobileRightSlot,
  stackMobileRightSlotBelow,
}: CompactPageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 overflow-hidden border-b border-[var(--surface-divider)] px-[var(--shell-content-px)] pb-2 pt-[calc(var(--safe-t)+8px)] shadow-[0_8px_28px_rgba(16,32,21,0.05)] backdrop-blur-md dark:shadow-[0_10px_32px_rgba(0,0,0,0.28)] sm:px-5 md:px-6 lg:static lg:z-40 lg:overflow-visible lg:border-b-0 lg:px-8 lg:pb-6 lg:pt-4 lg:shadow-none lg:backdrop-blur-none xl:px-10',
        className
      )}
    >
      <div className="absolute inset-0 bg-[var(--agri-bg)]/95 lg:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-b from-emerald-600 to-emerald-700 lg:block" />

      <div className="relative mx-auto w-full max-w-7xl">
        {(title || subtitle) && (
          <>
            <div
              className={cn(
                'flex min-h-[44px] items-start lg:hidden',
                stackMobileRightSlotBelow && showMobileRightSlot && rightSlot
                  ? 'flex-col gap-2'
                  : 'flex-wrap justify-between gap-x-2 gap-y-2'
              )}
            >
              <div
                className={cn(
                  'min-w-0',
                  !(stackMobileRightSlotBelow && showMobileRightSlot && rightSlot) && 'flex-1 basis-[min(100%,280px)]'
                )}
              >
                {title ? (
                  <h1 className="text-[clamp(1.15rem,4.6vw,1.35rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--agri-text)] [font-weight:750]">
                    {title}
                  </h1>
                ) : null}
                {subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-[var(--agri-text-muted)]">{subtitle}</p>
                ) : null}
              </div>
              {showMobileRightSlot && rightSlot ? (
                <div
                  className={cn(
                    'text-white [&_button]:text-[11px] [&_button]:sm:text-sm',
                    stackMobileRightSlotBelow
                      ? 'flex w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-2 border-t border-white/10 pt-2'
                      : 'shrink-0'
                  )}
                >
                  {rightSlot}
                </div>
              ) : null}
            </div>

            <div className="hidden items-start justify-between gap-3 lg:flex lg:items-center">
              <div className="min-w-0 space-y-0.5">
                {title ? <h1 className="truncate text-2xl font-semibold text-white">{title}</h1> : null}
                {subtitle ? <p className="line-clamp-2 text-sm text-emerald-100">{subtitle}</p> : null}
              </div>
              {rightSlot ? (
                <div className="flex shrink-0 items-center justify-end text-white lg:items-center">{rightSlot}</div>
              ) : null}
            </div>
          </>
        )}

        {summary ? <div className="mt-2 lg:mt-3">{summary}</div> : null}
      </div>
    </header>
  )
}
